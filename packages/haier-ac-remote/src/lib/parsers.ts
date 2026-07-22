// @ts-ignore
import { Parser } from 'binary-parser';
import { EventEmitter } from 'events';

// 6d01 status frame. Words are big-endian uint16; the opcode sits at word 5,
// so spec group index N == word (5 + N):
//   word6  grp1  actual temperature
//   word7  grp2  outdoor temp (low byte) + air quality (high byte)
//   word8  grp3  power consumption (low/high byte)
//   word9  grp4  PM value (16-bit)
//   word11 grp6  mode
//   word12 grp7  fan speed
//   word13 grp8  swing (bit0 up/down, bit1 left/right)
//   word14 grp9  flags: bit0 power, bit1 aux-heat, bit2 auto, bit3 health,
//                bit6 dehumidify, bit10 eco, bit11 F/C, bit15 child-lock
//   word15 grp10 flags: bit0 fresh-air, bit1 turbo, bit2 quiet, ...
//   word16 grp11 humidity (low byte actual, high byte setpoint)
//   word17 grp12 set temperature (raw = °C - 16)
export const stateParser = new Parser()
  .endianess('big')
  .uint16('start', { assert: 0xffff })
  .uint16('_', { assert: 0x2200 })
  .uint16('_2')
  .uint16('_3')
  .uint16('_4')
  .uint16('_5')
  .uint16('currentTemperature')
  .uint16('sensorWord') // grp2: outdoor temp (lo) + air quality (hi)
  .uint16('powerWord') // grp3: power consumption
  .uint16('pmValue') // grp4: PM value
  .uint16('_10')
  .uint16('mode')
  .uint16('fanSpeed')
  .uint16('limits')
  .uint16('flags1') // grp9
  .uint16('flags2') // grp10
  .uint16('humidityWord') // grp11
  .uint16('targetTemperature');

const bit = (word: number, n: number) => Boolean((word >> n) & 1);

// A device response frame is: [00 00 27 15] + 76 header bytes (the byte at
// offset 79 is the inner-frame length) + <innerLen> inner-frame bytes.
const RESP_HEADER = Buffer.from([0x00, 0x00, 0x27, 0x15]);
const RESP_HEADER_LEN = 80; // bytes before the inner frame; inner length at [79]

// Pull complete response frames out of a TCP byte stream, returning the leftover
// bytes so a frame split across 'data' events is reassembled instead of dropped.
// Resynchronises past junk/misaligned bytes by scanning for the next header.
export function extractFrames(buffer: Buffer): { frames: Buffer[]; rest: Buffer } {
  const frames: Buffer[] = [];
  let offset = 0;

  for (;;) {
    const idx = buffer.indexOf(RESP_HEADER, offset);
    if (idx < 0) {
      // No header ahead; keep only a possible partial header at the very end.
      const keepFrom = Math.max(offset, buffer.length - (RESP_HEADER.length - 1));
      return { frames, rest: buffer.subarray(keepFrom) };
    }
    if (buffer.length - idx < RESP_HEADER_LEN) {
      return { frames, rest: buffer.subarray(idx) }; // not enough to read the length yet
    }
    const innerLen = buffer[idx + RESP_HEADER_LEN - 1];
    const total = RESP_HEADER_LEN + innerLen;
    if (buffer.length - idx < total) {
      return { frames, rest: buffer.subarray(idx) }; // full frame not arrived yet
    }
    frames.push(buffer.subarray(idx, idx + total));
    offset = idx + total;
  }
}

enum CommandType {
  xz1 = 0x10,
  state = 0x22,
}

enum PayloadType {
  request = 0x14,
  response = 0x15,
}

enum ParserState {
  start_req_or_res = 1,
  res_start_zero4,
  seq4,
  first_zero,
  second_zero,
  mac_address,
  third_zero,
  scan_command_length,
  parse_command,
}

export type TheParserResult = {
  seq: number;
  type: PayloadType;
  mac: string;
  command: Buffer;
  commandType: CommandType;
};

export class TheParser extends EventEmitter {
  state: ParserState = ParserState.start_req_or_res;
  startIndex = 0;
  result: Record<string, any> = {}; // TheParserResult
  results: TheParserResult[] = [];
  protected commandLength = 0;
  protected checkSum = 0;

  parse(buf: Buffer) {
    this.reset();

    buf.forEach((b, index) => {
      this.execute(b, index);
    });

    return this.results;
  }

  protected reset() {
    this.state = ParserState.start_req_or_res;
    this.startIndex = 0;
    this.result = {};
    this.commandLength = 0;
    this.checkSum = 0;
    this.results = [];
  }

  // eslint-disable-next-line complexity
  protected execute(b: number, index: number) {
    const offset = index - this.startIndex;

    switch (this.state) {
      case ParserState.start_req_or_res:
        if (offset < 2 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 2 && b !== 0x27) {
          throw new Error(`${this.state}`);
        }

        if (offset === 3 && b === 0x15) {
          this.result.type = PayloadType.response;

          return this.updateState(ParserState.res_start_zero4, index);
        }

        break;

      case ParserState.res_start_zero4:
        if (offset <= 3 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 3) {
          return this.updateState(ParserState.first_zero, index);
        }

        break;

      case ParserState.first_zero:
        if (offset <= 15 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 15) {
          return this.updateState(ParserState.second_zero, index);
        }

        break;

      case ParserState.second_zero:
        if (offset <= 15 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 15 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 15) {
          return this.updateState(ParserState.mac_address, index);
        }

        break;

      case ParserState.mac_address:
        if (offset === 0) {
          this.result.mac = '';

          return;
        }

        if (offset <= 11) {
          this.result.mac += String.fromCharCode(b);
        }

        if (offset === 15) {
          return this.updateState(ParserState.third_zero, index);
        }

        break;

      case ParserState.third_zero:
        if (offset <= 15 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 15) {
          return this.updateState(ParserState.scan_command_length, index);
        }

        break;

      case ParserState.scan_command_length:
        if (offset < 7 && offset !== 3 && b !== 0) {
          throw new Error(`${this.state}`);
        }

        if (offset === 3) {
          this.result.seq = b;
        }

        if (offset === 7) {
          this.commandLength = b;
          this.result.command = Buffer.alloc(b);

          return this.updateState(ParserState.parse_command, index);
        }

        break;

      case ParserState.parse_command:
        (this.result.command as Buffer).writeUInt8(b, offset);

        if (offset < 2 && b !== 0xff) {
          throw new Error(`${this.state}`);
        }

        if (offset < 2) {
          return;
        }

        if (offset === 2) {
          this.result.commandType = b;
        }

        if (offset >= 2) {
          this.checkSum = b;
        }

        if (offset === this.commandLength - 1 && b !== this.checkSum) {
          throw new Error(`${this.state}`);
        }

        if (offset === this.commandLength - 1) {
          this.results.push(this.result as any);
          this.emit('parseCompleted', this.result);
          this.result = {};

          return this.updateState(ParserState.start_req_or_res, index);
        }

        break;
    }
  }

  protected updateState(state: ParserState, index: number) {
    this.startIndex = index + 1;
    this.state = state;
  }
}

type Output = Omit<TheParserResult, 'command'> & {
  commandType: CommandType.state;
  state: {
    currentTemperature: number;
    targetTemperature: number;
    fanSpeed: any;
    mode: any;
    health: boolean;
    limits: any;
    power: boolean;
    outdoorTemperature: number;
    currentHumidity: number;
    airQuality: number;
    pmValue: number;
    auxHeat: boolean;
    auto: boolean;
    dehumidify: boolean;
    eco: boolean;
    childLock: boolean;
    freshAir: boolean;
    turbo: boolean;
    quiet: boolean;
  };
};

export function parseState(parsedRes: TheParserResult[]): Output | null {
  try {
    const stateResponse = parsedRes.find(
      (r) => r.type === PayloadType.response && r.commandType === CommandType.state,
    ) as TheParserResult;
    const state = stateParser.parse(stateResponse.command);

    const flags1: number = state.flags1; // grp9
    const flags2: number = state.flags2; // grp10

    const nextState = {
      currentTemperature: state.currentTemperature,
      targetTemperature: state.targetTemperature + 16,
      fanSpeed: state.fanSpeed,
      mode: state.mode,
      limits: state.limits,
      // power = grp9 bit0, health/anion = grp9 bit3 (both in flags1/word14).
      power: bit(flags1, 0),
      health: bit(flags1, 3),
      // Telemetry
      outdoorTemperature: state.sensorWord & 0xff,
      airQuality: (state.sensorWord >> 8) & 0xff,
      pmValue: state.pmValue,
      currentHumidity: state.humidityWord & 0xff,
      // Secondary flags (read-only)
      auxHeat: bit(flags1, 1),
      auto: bit(flags1, 2),
      dehumidify: bit(flags1, 6),
      eco: bit(flags1, 10),
      childLock: bit(flags1, 15),
      freshAir: bit(flags2, 0),
      turbo: bit(flags2, 1),
      quiet: bit(flags2, 2),
    };

    return {
      seq: stateResponse.seq,
      type: stateResponse.type,
      mac: stateResponse.mac,
      commandType: CommandType.state,
      state: nextState,
    };
  } catch (err) {
    return null;
  }
}

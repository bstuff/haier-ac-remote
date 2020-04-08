// @ts-ignore
import { Parser } from 'binary-parser';
import { EventEmitter } from 'events';

export const stateParser = new Parser()
  .endianess('big')
  .uint16('start', { assert: 0xffff })
  .uint16('_', { assert: 0x2200 })
  .uint16('_')
  .uint16('_')
  .uint16('_')
  .uint16('_')
  .uint16('currentTemperature')
  .uint16('_')
  .uint16('_')
  .uint16('_')
  .uint16('_')
  .uint16('mode')
  .uint16('fanSpeed')
  .uint16('limits')
  .uint16('power')
  .uint16('health')
  .uint16('_')
  .uint16('targetTemperature');

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
    currentTemperature: any;
    targetTemperature: any;
    fanSpeed: any;
    mode: any;
    health: any;
    limits: any;
    power: any;
  };
};

export function parseState(parsedRes: TheParserResult[]): Output | null {
  try {
    const stateResponse = parsedRes.find(
      (r) => r.type === PayloadType.response && r.commandType === CommandType.state,
    ) as TheParserResult;
    const state = stateParser.parse(stateResponse.command);

    const nextState = {
      currentTemperature: state.currentTemperature,
      targetTemperature: state.targetTemperature + 16,
      fanSpeed: state.fanSpeed,
      mode: state.mode,
      health: state.health,
      limits: state.limits,
      power: state.power,
    };

    if (typeof nextState.power === 'number') {
      nextState.power = Boolean(nextState.power % 2);
    }

    if (typeof nextState.health === 'number') {
      nextState.health = Boolean(nextState.health % 2);
    }

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

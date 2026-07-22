import { setState } from '../lib/raw-commands';
import { parseState, TheParserResult } from '../lib/parsers';
import { State, FanSpeed, Mode, Limits } from '../_types';

function toBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .map((h) => parseInt(h, 16));
}

const base: State = {
  currentTemperature: 24,
  targetTemperature: 24,
  fanSpeed: FanSpeed.MID,
  mode: Mode.COOL,
  health: false,
  limits: Limits.OFF,
  power: true,
};

describe('setState() 4d5f group-command encoding', () => {
  it('carries health in word14 bit3 (grp9) and leaves word15/grp10 fresh-air untouched', () => {
    const b = toBytes(setState({ ...base, health: true }));

    // word14 (bytes 28-29) = grp9: bit0 power + bit3 health => 0x09
    expect(b[28]).toBe(0x00);
    expect(b[29]).toBe(0x09);

    // word15 (bytes 30-31) = grp10 (fresh-air bit0). MUST stay 0 — this is the
    // regression that previously turned fresh-air on whenever health was on.
    expect(b[30]).toBe(0x00);
    expect(b[31]).toBe(0x00);
  });

  it('health off => word14 = 0x01 (power only), word15 still 0', () => {
    const b = toBytes(setState({ ...base, health: false }));
    expect(b[29]).toBe(0x01);
    expect(b[31]).toBe(0x00);
  });

  it('places mode/fan/swing/temp at their spec word positions', () => {
    const b = toBytes(
      setState({
        ...base,
        mode: Mode.HEAT,
        fanSpeed: FanSpeed.AUTO,
        limits: Limits.ONLY_VERTICAL,
        targetTemperature: 25,
      }),
    );
    expect(b[23]).toBe(Mode.HEAT); // word11 grp6
    expect(b[25]).toBe(FanSpeed.AUTO); // word12 grp7
    expect(b[27]).toBe(Limits.ONLY_VERTICAL); // word13 grp8 bit0
    expect(b[35]).toBe(25 - 16); // word17 grp12 (raw = °C - 16)
  });

  it('produces a valid single-byte checksum', () => {
    const b = toBytes(setState({ ...base, health: true, targetTemperature: 24 }));
    const sum = b.slice(2, b.length - 1).reduce((p, c) => p + c, 0); // bytes after ff ff
    expect(b[b.length - 1]).toBe(sum & 0xff);
  });
});

describe('parseState() 6d01 status decoding', () => {
  function buildStatusResult(words: Record<number, number>): TheParserResult[] {
    const buf = Buffer.alloc(36); // 18 uint16 words
    buf.writeUInt16BE(0xffff, 0); // word0 start
    buf.writeUInt16BE(0x2200, 2); // word1 (len/type marker asserted by parser)
    for (const [w, v] of Object.entries(words)) {
      buf.writeUInt16BE(v & 0xffff, Number(w) * 2);
    }
    return [
      {
        seq: 0,
        type: 0x15 as any, // PayloadType.response
        mac: 'test',
        command: buf,
        commandType: 0x22 as any, // CommandType.state
      },
    ];
  }

  it('decodes health from grp9 bit3 (not grp10 fresh-air) and reads sensors', () => {
    const out = parseState(
      buildStatusResult({
        6: 25, // currentTemperature
        7: (2 << 8) | 30, // grp2: airQuality=2 (hi), outdoorTemp=30 (lo)
        9: 35, // grp4: PM
        11: Mode.COOL, // grp6
        12: FanSpeed.MID, // grp7
        13: Limits.ONLY_VERTICAL, // grp8
        14: 0x0001 | 0x0008 | 0x0040, // grp9: power(b0)+health(b3)+dehumidify(b6)
        15: 0x0001 | 0x0002, // grp10: fresh-air(b0)+turbo(b1)
        16: 55, // grp11: humidity lo
        17: 24 - 16, // grp12: set temp raw
      }),
    );

    expect(out).not.toBeNull();
    const s = out!.state;
    expect(s.power).toBe(true);
    expect(s.health).toBe(true); // grp9 bit3 — the fix
    expect(s.dehumidify).toBe(true); // grp9 bit6
    expect(s.freshAir).toBe(true); // grp10 bit0
    expect(s.turbo).toBe(true); // grp10 bit1
    expect(s.currentTemperature).toBe(25);
    expect(s.targetTemperature).toBe(24);
    expect(s.outdoorTemperature).toBe(30);
    expect(s.airQuality).toBe(2);
    expect(s.pmValue).toBe(35);
    expect(s.currentHumidity).toBe(55);
  });

  it('health false when grp9 bit3 clear even if grp10 fresh-air is set', () => {
    const out = parseState(
      buildStatusResult({
        14: 0x0001, // grp9: power only, health bit3 = 0
        15: 0x0001, // grp10: fresh-air on (must NOT be read as health)
      }),
    );
    expect(out!.state.health).toBe(false);
    expect(out!.state.freshAir).toBe(true);
  });
});

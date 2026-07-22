import { State } from '../_types';

export const request = () => `00 00 27 14 00 00 00 00`;
export const zero16 = () => `00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00`;
// hello = opcode 4d01 = "query status" (spec 2000ZZ 查询状态): the device
// replies with a 6d01 state frame. This is the documented way to fetch state.
export const hello = () => `ff ff 0a 00 00 00 00 00 00 01 4d 01 59`;
export const on = () => `ff ff 0a 00 00 00 00 00 00 01 4d 02 5a`;
export const off = () => `ff ff 0a 00 00 00 00 00 00 01 4d 03 5b`;

// Render a number as a single, zero-padded, masked hex byte ("00".."ff").
const byte = (n: number) => (n & 0xff).toString(16).padStart(2, '0');

export const macAddress = (macAddress: string) => {
  macAddress = macAddress.replace(/[^a-f\d]/gi, '').toUpperCase();
  const res: string[] = [];

  for (const str of macAddress) {
    res.push(str.charCodeAt(0).toString(16));
  }

  res.push(...['00', '00', '00', '00']);

  return res.join(' ');
};

export const setState = (state: State) => {
  // 0x4d5f "group command" body. Fields land at big-endian uint16 word indices
  // (opcode 4d5f is at word 5), so spec word index N -> on-wire word (5 + N):
  //   word11 grp6  = mode
  //   word12 grp7  = fan speed
  //   word13 grp8  = up/down swing (bit0)
  //   word14 grp9  = flags: bit0 power, bit3 health/anion
  //   word15 grp10 = flags: bit0 fresh-air, bit1 turbo, ...  (left untouched)
  //   word16 grp11 = humidity setpoint (left 0)
  //   word17 grp12 = set temperature (raw = °C - 16)
  //
  // NOTE: power bit0 is intentionally always on here; power-off is issued via
  // the dedicated off() opcode (0x4d03). Health is carried ONLY in word14 bit3.
  const powerHealthByte = 0x01 | (state.health ? 0x08 : 0);

  let res = `ff ff 22 00 00 00 00 00 00 01 4d 5f 00 00 00 00 00 00 00 00 00 00`;
  res = `${res} 00 ${byte(state.mode)}`;
  res = `${res} 00 ${byte(state.fanSpeed)}`;
  res = `${res} 00 ${byte(state.limits)}`;
  res = `${res} 00 ${byte(powerHealthByte)}`;
  // word15 (grp10) — leave zero. Previously this word was written with the
  // health value, which set grp10 bit0 = FRESH-AIR on whenever health was on.
  res = `${res} 00 00`;
  res = `${res} 00 00 00 ${byte(state.targetTemperature - 16)}`;

  return appendChecksum(res);
};

function appendChecksum(str: string) {
  const sum = str
    .replace(/[^0-9a-f]/gi, '')
    .split('')
    .reduce((p, c, i) => {
      return p + parseInt(c, 16) * (i % 2 ? 1 : 16);
    }, 0);

  // Checksum = sum of all bytes AFTER the leading 0xffff prefix, mod 256
  // (subtract 0xff + 0xff = 510 for the two prefix bytes).
  const checkSum = ((sum - 2 * 255) & 0xff).toString(16).padStart(2, '0');

  return `${str} ${checkSum}`;
}

export const orderByte = (n: number) =>
  n % 256 < 16 ? `00 00 00 0${(n % 256).toString(16)}` : `00 00 00 ${(n % 256).toString(16)}`;

export const len4 = (cmd: string) => {
  const length = cmd.replace(/[^0-9a-f]/gi, '').split('').length / 2;

  return orderByte(length);
};

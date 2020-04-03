import { State } from '../_types';

export const request = () => `00 00 27 14 00 00 00 00`;
export const response = () => `00 00 27 15 00 00 00 00`;
export const zero16 = () => `00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00`;
export const hello = () => `ff ff 0a 00 00 00 00 00 00 01 4d 01 59`;
export const on = () => `ff ff 0a 00 00 00 00 00 00 01 4d 02 5a`;
export const off = () => `ff ff 0a 00 00 00 00 00 00 01 4d 03 5b`;
export const init = () => `ff ff 08 00 00 00 00 00 00 73 7b`;

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
  let res = `ff ff 22 00 00 00 00 00 00 01 4d 5f 00 00 00 00 00 00 00 00 00 00`;
  res = `${res} 00 0${state.mode}`;
  res = `${res} 00 0${state.fanSpeed}`;
  res = `${res} 00 0${state.limits}`;
  res = `${res} 00 0${Number(state.health) ? 9 : 1}`; // power
  res = `${res} 00 0${Number(state.health)}`;
  res = `${res} 00 00 00 0${(state.targetTemperature - 16).toString(16)}`;

  return appendChecksum(res);
};

function appendChecksum(str: string) {
  const checkSum = (
    str
      .replace(/[^0-f]/g, '')
      .split('')
      .reduce((p, c, i) => {
        return p + parseInt(c, 16) * (i % 2 ? 1 : 16);
      }, 0) -
    2 * 255
  ).toString(16);

  const res = `${str} ${checkSum}`;

  return res;
}

export const orderByte = (n: number) =>
  n % 256 < 16 ? `00 00 00 0${(n % 256).toString(16)}` : `00 00 00 ${(n % 256).toString(16)}`;

export const len4 = (cmd: string) => {
  const length = cmd.replace(/[^0-f]/g, '').split('').length / 2;

  return orderByte(length);
};

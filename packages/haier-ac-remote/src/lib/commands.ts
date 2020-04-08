import { State } from '../_types';

import * as rawCommands from './raw-commands';
import { toHex } from './toHex';

export const ping = (macAddress: string, seq = 0) =>
  toHex(
    //
    `00 00 5d f2 00 00 00 00`,
    `00 00 00 ${rawCommands.orderByte(seq)} 00 00 00 30`,
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
  );

export const on = (macAddress: string, seq = 1) =>
  toHex(
    rawCommands.request(),
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
    rawCommands.zero16(),
    rawCommands.orderByte(seq),
    rawCommands.len4(rawCommands.on()),
    rawCommands.on(),
  );

export const off = (macAddress: string, seq = 1) =>
  toHex(
    rawCommands.request(),
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
    rawCommands.zero16(),
    rawCommands.orderByte(seq),
    rawCommands.len4(rawCommands.off()),
    rawCommands.off(),
  );

export const setState = (macAddress: string, state: State, seq = 1) => {
  return toHex(
    rawCommands.request(),
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
    rawCommands.zero16(),
    rawCommands.orderByte(seq),
    rawCommands.len4(rawCommands.setState(state)),
    rawCommands.setState(state),
  );
};

//before init
export const hello = (macAddress: string, seq = 0) =>
  toHex(
    rawCommands.request(),
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
    rawCommands.zero16(),
    rawCommands.orderByte(seq),
    rawCommands.len4(rawCommands.hello()),
    rawCommands.hello(),
  );

export const init = (macAddress: string, seq = 0) =>
  toHex(
    rawCommands.request(),
    rawCommands.zero16(),
    rawCommands.zero16(),
    rawCommands.macAddress(macAddress),
    rawCommands.zero16(),
    rawCommands.orderByte(seq),
    rawCommands.len4(rawCommands.init()),
    rawCommands.init(),
  );

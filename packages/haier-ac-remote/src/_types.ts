export enum Limits {
  OFF = 0,
  ONLY_VERTICAL = 1,
}

export enum FanSpeed {
  MAX = 0,
  MID = 1,
  MIN = 2,
  AUTO = 3,
}

export enum Mode {
  SMART = 0,
  COOL = 1,
  HEAT = 2,
  FAN = 3,
  DRY = 4,
}

export type State = {
  currentTemperature: number;
  targetTemperature: number;
  fanSpeed: FanSpeed;
  mode: Mode;
  health: boolean;
  limits: Limits;
  power: boolean;

  // Read-only telemetry decoded from the 6d01 status frame. Optional so that
  // existing consumers (and the setState path) are unaffected. Populated by
  // parseState(); ignored by changeState()/setState().
  outdoorTemperature?: number; // grp2 low byte (602003 外温), °C
  currentHumidity?: number; // grp11 low byte (602002 实湿), %RH
  airQuality?: number; // grp2 high byte (602004 空质), 0..3 enum
  pmValue?: number; // grp4 16-bit (602008 PM值)

  // Read-only secondary flags decoded from grp9 (word14) / grp10 (word15).
  // These reflect device status; they are not (yet) settable via changeState.
  auxHeat?: boolean; // grp9 bit1 (202007/8 电辅热)
  auto?: boolean; // grp9 bit2 (20200l/m 自动)
  dehumidify?: boolean; // grp9 bit6 (202009/a 除湿)
  eco?: boolean; // grp9 bit10 (20200M 节能)
  childLock?: boolean; // grp9 bit15 (20200j/k 童锁)
  freshAir?: boolean; // grp10 bit0 (202003/4 新风)
  turbo?: boolean; // grp10 bit1 (20200O 强力)
  quiet?: boolean; // grp10 bit2 (20200P 静音)
};

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
};

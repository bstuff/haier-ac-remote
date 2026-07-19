import { FanSpeed, HaierAC, Limits, Mode } from 'haier-ac-remote';
import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';

export class HapHaierAC implements AccessoryPlugin {
  protected readonly api: API;
  protected readonly log: Logging;
  protected readonly device: HaierAC;
  protected readonly name: string;
  protected readonly autoMode: Mode;

  protected readonly informationService: Service;
  protected readonly heaterCooler: Service;
  protected readonly healthSwitch: Service;

  constructor(log: Logging, baseConfig: AccessoryConfig, api: API) {
    const config = Object.assign({ timeout: 3000, treatAutoHeatAs: 'fan' }, baseConfig);

    if (!config.ip) throw new Error('You must provide the IP address of the AC');
    if (!config.mac) throw new Error('You must provide the MAC of the AC');

    this.api = api;
    this.log = log;
    this.name = config.name;
    this.autoMode = config.treatAutoHeatAs === 'smart' ? Mode.SMART : Mode.FAN;
    this.device = new HaierAC({ ip: config.ip, mac: config.mac, timeout: config.timeout });

    const { Characteristic } = api.hap;

    this.informationService = new api.hap.Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'Haier')
      .setCharacteristic(Characteristic.Model, 'AirCond')
      .setCharacteristic(Characteristic.SerialNumber, config.mac);

    // Air conditioner -> native HeaterCooler service
    this.heaterCooler = new api.hap.Service.HeaterCooler(this.name);

    this.heaterCooler
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getActive)
      .onSet(this.setActive);

    this.heaterCooler
      .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState);

    this.heaterCooler
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          Characteristic.TargetHeaterCoolerState.AUTO,
          Characteristic.TargetHeaterCoolerState.HEAT,
          Characteristic.TargetHeaterCoolerState.COOL,
        ],
      })
      .onGet(this.getTargetHeaterCoolerState)
      .onSet(this.setTargetHeaterCoolerState);

    this.heaterCooler
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature);

    const tempProps = { minValue: 16, maxValue: 30, minStep: 1 };
    this.heaterCooler
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps(tempProps)
      .onGet(this.getTargetTemperature)
      .onSet(this.setTargetTemperature);
    this.heaterCooler
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps(tempProps)
      .onGet(this.getTargetTemperature)
      .onSet(this.setTargetTemperature);

    this.heaterCooler
      .getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
      .onGet(this.getRotationSpeed)
      .onSet(this.setRotationSpeed);

    this.heaterCooler
      .getCharacteristic(Characteristic.SwingMode)
      .onGet(this.getSwingMode)
      .onSet(this.setSwingMode);

    // Health / ionizer -> honest Switch (was a Lightbulb)
    this.healthSwitch = new api.hap.Service.Switch(`${this.name} Health`, 'health');
    this.healthSwitch
      .getCharacteristic(Characteristic.On)
      .onGet(this.getHealth)
      .onSet(this.setHealth);

    // Reflect changes made from the physical remote back into HomeKit.
    this.device.state$.subscribe(this.pushState);
  }

  getServices(): Service[] {
    return [this.informationService, this.heaterCooler, this.healthSwitch];
  }

  protected pushState = () => {
    const { Characteristic } = this.api.hap;
    this.heaterCooler.updateCharacteristic(Characteristic.Active, this.getActive());
    this.heaterCooler.updateCharacteristic(
      Characteristic.CurrentHeaterCoolerState,
      this.getCurrentHeaterCoolerState(),
    );
    this.heaterCooler.updateCharacteristic(
      Characteristic.TargetHeaterCoolerState,
      this.getTargetHeaterCoolerState(),
    );
    this.heaterCooler.updateCharacteristic(
      Characteristic.CurrentTemperature,
      this.getCurrentTemperature(),
    );
    this.heaterCooler.updateCharacteristic(
      Characteristic.CoolingThresholdTemperature,
      this.getTargetTemperature(),
    );
    this.heaterCooler.updateCharacteristic(
      Characteristic.HeatingThresholdTemperature,
      this.getTargetTemperature(),
    );
    this.heaterCooler.updateCharacteristic(Characteristic.RotationSpeed, this.getRotationSpeed());
    this.heaterCooler.updateCharacteristic(Characteristic.SwingMode, this.getSwingMode());
    this.healthSwitch.updateCharacteristic(Characteristic.On, this.getHealth());
  };

  // ---- getters (read synchronously from the reactive state) ----

  protected getActive = (): CharacteristicValue => {
    const { Active } = this.api.hap.Characteristic;
    return this.device.state$.value.power ? Active.ACTIVE : Active.INACTIVE;
  };

  protected getCurrentHeaterCoolerState = (): CharacteristicValue => {
    const { CurrentHeaterCoolerState } = this.api.hap.Characteristic;
    const { power, mode } = this.device.state$.value;

    if (!power) return CurrentHeaterCoolerState.INACTIVE;
    if (mode === Mode.HEAT) return CurrentHeaterCoolerState.HEATING;
    if (mode === Mode.COOL) return CurrentHeaterCoolerState.COOLING;

    return CurrentHeaterCoolerState.IDLE;
  };

  protected getTargetHeaterCoolerState = (): CharacteristicValue => {
    const { TargetHeaterCoolerState } = this.api.hap.Characteristic;

    switch (this.device.state$.value.mode) {
      case Mode.HEAT:
        return TargetHeaterCoolerState.HEAT;
      case Mode.COOL:
        return TargetHeaterCoolerState.COOL;
      default:
        return TargetHeaterCoolerState.AUTO;
    }
  };

  protected getCurrentTemperature = (): CharacteristicValue => {
    return this.device.state$.value.currentTemperature;
  };

  protected getTargetTemperature = (): CharacteristicValue => {
    return this.device.state$.value.targetTemperature;
  };

  protected getRotationSpeed = (): CharacteristicValue => {
    switch (this.device.state$.value.fanSpeed) {
      case FanSpeed.MIN:
        return 33;
      case FanSpeed.MID:
        return 66;
      case FanSpeed.MAX:
        return 100;
      default:
      case FanSpeed.AUTO:
        return 0; // 0% represents automatic fan speed
    }
  };

  protected getSwingMode = (): CharacteristicValue => {
    const { SwingMode } = this.api.hap.Characteristic;
    const { power, limits } = this.device.state$.value;

    return power && limits === Limits.ONLY_VERTICAL
      ? SwingMode.SWING_ENABLED
      : SwingMode.SWING_DISABLED;
  };

  protected getHealth = (): CharacteristicValue => {
    return this.device.state$.value.health;
  };

  // ---- setters ----

  protected setActive = async (value: CharacteristicValue) => {
    const { Active } = this.api.hap.Characteristic;
    try {
      if (value === Active.ACTIVE) {
        if (!this.device.state$.value.power) await this.device.on();
      } else if (this.device.state$.value.power) {
        await this.device.off();
      }
    } catch (error) {
      this.log.error(String(error));
    }
  };

  protected setTargetHeaterCoolerState = async (value: CharacteristicValue) => {
    const { TargetHeaterCoolerState } = this.api.hap.Characteristic;
    let mode = this.autoMode;
    if (value === TargetHeaterCoolerState.HEAT) mode = Mode.HEAT;
    else if (value === TargetHeaterCoolerState.COOL) mode = Mode.COOL;

    try {
      if (this.device.state$.value.mode !== mode) {
        await this.device.changeState({ mode });
      }
    } catch (error) {
      this.log.error(String(error));
    }
  };

  protected setTargetTemperature = async (value: CharacteristicValue) => {
    try {
      await this.device.changeState({ targetTemperature: Number(value) });
    } catch (error) {
      this.log.error(String(error));
    }
  };

  protected setRotationSpeed = async (value: CharacteristicValue) => {
    const speed = Number(value);
    let fanSpeed = FanSpeed.AUTO;
    if (speed > 0 && speed <= 33) fanSpeed = FanSpeed.MIN;
    else if (speed > 33 && speed <= 66) fanSpeed = FanSpeed.MID;
    else if (speed > 66) fanSpeed = FanSpeed.MAX;

    try {
      await this.device.changeState({ fanSpeed });
    } catch (error) {
      this.log.error(String(error));
    }
  };

  protected setSwingMode = async (value: CharacteristicValue) => {
    const { SwingMode } = this.api.hap.Characteristic;
    const limits = value === SwingMode.SWING_ENABLED ? Limits.ONLY_VERTICAL : Limits.OFF;
    try {
      await this.device.changeState({ limits });
    } catch (error) {
      this.log.error(String(error));
    }
  };

  protected setHealth = async (value: CharacteristicValue) => {
    try {
      await this.device.changeState({ health: Boolean(value) });
    } catch (error) {
      this.log.error(String(error));
    }
  };
}

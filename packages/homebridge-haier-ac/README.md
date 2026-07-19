# homebridge-haier-ac

[![npm version](https://badge.fury.io/js/homebridge-haier-ac.svg)](https://badge.fury.io/js/homebridge-haier-ac)

Homebridge plugin for controlling Haier Air Conditioner

## Installation

1. Install this plugin by running `npm install -g homebridge-haier-ac`.
2. Assign static IP address to your AC (check your router settings to do that).
3. Update your Homebridge `config.json`. Check `config-sample.jsonc` for reference.
   - Required parameters:
     - `accessory` - always "HaierAC"
     - `name` - Name of your device
     - `ip` - IP address of air conditioner
     - `mac` - MAC address of air conditioner in format `0001325476AC`
   - Optional parameters:
     - `treatAutoHeatAs` - `fan`/`smart` (default `fan`). Which AC mode HomeKit's `AUTO` maps to

## config.json

```json
"accessories": [
    {
        "accessory": "HaierAC",
        "ip": "192.168.250.102",
        "mac": "0007A8E578A8",
        "name": "Living Room Conditioner",
        "treatAutoHeatAs": "fan"
    }
]
```

## How it appears in HomeKit

The AC is exposed as a native **Heater Cooler** accessory (plus a small switch):

| HomeKit control               | Maps to                                     |
| ----------------------------- | ------------------------------------------- |
| On / Off (`Active`)           | Power                                       |
| Mode `AUTO` / `HEAT` / `COOL` | `treatAutoHeatAs` (smart/fan) / heat / cool |
| Current temperature           | Sensor reading from the AC                  |
| Target temperature            | Cooling/heating threshold, 16–30 °C         |
| Fan speed                     | `0%` = auto, then low / medium / high       |
| Swing                         | Vertical louver                             |
| **Health** switch             | Ionizer / health mode                       |

Changes made with the physical remote are pushed back to HomeKit automatically.

> Fan speed uses `0%` to mean **automatic** (on/off is a separate `Active` control on
> a Heater Cooler, so `0%` is a valid "auto" speed rather than "off").

## Features

- Power on/off, mode, target/current temperature, fan speed, swing, health
- Reacts to changes made with the AC's own remote

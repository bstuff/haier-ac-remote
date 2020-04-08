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
        - `treatAutoHeatAs` - `fan`/`smart` (default `fan`). Select mode binded to 'auto' in homekit

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

## Features

- Turning AC on and off
- Getting and setting target temperature
- Getting current temperature
- Getting and setting mode
- Getting and setting swing mode
- Getting and setting wind level
- Reacting to changes made by using AC's remote

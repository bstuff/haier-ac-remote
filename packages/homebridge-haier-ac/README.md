# homebridge-haier-ac

[![npm version](https://badge.fury.io/js/homebridge-haier-ac.svg)](https://badge.fury.io/js/homebridge-haier-ac) <iframe src="https://money.yandex.ru/quickpay/button-widget?targets=%D0%B4%D0%BE%D0%BD%D0%B0%D1%82%D1%8B&default-sum=100&button-text=11&yamoney-payment-type=on&button-size=s&button-color=orange&successURL=&quickpay=small&account=41001836515224&" width="127" height="25" frameborder="0" allowtransparency="true" scrolling="no"></iframe>

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
        - `treatAutoHeatAs` - `fan`/`smart` (default `smart`). Select mode binded to 'auto' in homekit

## Features

- Turning AC on and off
- Getting and setting target temperature
- Getting current temperature
- Getting and setting mode
- Getting and setting swing mode
- Getting and setting wind level
- Reacting to changes made by using AC's remote

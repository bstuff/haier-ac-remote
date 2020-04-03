# haier-ac-remote

> A node module remote controller for Haier air conditioner.

## Usage

```bash
$ npm install haier-ac-remote
```

### Examples

see example [here](src/examples/index.ts)

```typescript
import { HaierAC, Mode } from 'haier-ac-remote';

const ac = new HaierAC({
  ip: '192.168.1.23',
  mac: '00:12:34:56:78:AC',
});

// turn on
await ac.on();

// set mode to heat
await ac.changeState({ mode: Mode.COOL });

// set temperature to 23*
await ac.changeState({ targetTemperature: 23 });

// turn off
await ac.off();
```

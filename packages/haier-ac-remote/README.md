# haier-ac-remote

> A node module remote controller for Haier air conditioner.

## Usage

```bash
$ npm install haier-ac-remote
```

### Examples

#### Local example

see example [here](src/examples/index.ts)

1. `git clone git@github.com:bstuff/haier-ac-remote.git`
2. `cd packages/haier-ac-remote`
3. `npm install`
4. Write `ip` and `mac` of your haier conditioner in `src/examples/index.ts`.
5. Run `npm run example`
6. use keyboard keys:
  - `w` to power on
  - `s` to power off
  - `↑` to increase temperature
  - `↓` to decrease temperature

#### Example usage in other projects

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

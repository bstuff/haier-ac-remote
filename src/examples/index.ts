import * as readline from 'readline';

import { HaierAC } from '../HaierAC';

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

const haierAC = new HaierAC({
  ip: '192.168.31.111',
  mac: '0007A8E917AC',
});

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    process.exit(0);
  }

  if (key.name === 'w') {
    haierAC.on();
  }

  if (key.name === 's') {
    haierAC.off();
  }

  if (key.name === 'up') {
    haierAC.changeState({
      targetTemperature: haierAC.state$.value.targetTemperature + 1,
    });
  }

  if (key.name === 'down') {
    haierAC.changeState({
      targetTemperature: haierAC.state$.value.targetTemperature - 1,
    });
  }
});

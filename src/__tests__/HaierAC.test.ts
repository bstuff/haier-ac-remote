import { HaierAC } from '../HaierAC';
import * as rawCommands from '../lib/raw-commands';
import { toHex } from '../lib/toHex';

describe('HaierAC', () => {
  let ac: HaierAC;

  describe('state$', () => {
    beforeEach(() => {
      ac = new HaierAC({ ip: '0.0.0.0', mac: '' });
    });

    it('should work', () => {
      // @ts-ignore
      ac._rawData$.next(
        toHex(
          `00 00 27 15 00 00 00 00`,
          rawCommands.zero16(),
          rawCommands.zero16(),
          rawCommands.macAddress('00:07:A8:17:E9:AC'),
          rawCommands.zero16(),
          `00 00 00 01 00 00 00 25`,
          `ff ff 22 00 00 00 00 00`,
          `01 06 6d 01 00 15 00 00`,
          `00 7f 00 00 00 00 00 02`,
          `00 02 00 00 00 09 00 01`,
          `00 00 00 0c 45`,
        ),
      );

      expect(ac.state$.value).toMatchSnapshot();
    });
  });
});

import { parseState } from '../lib/parsers';
import * as rawCommands from '../lib/raw-commands';
import { toHex } from '../lib/toHex';

describe('responseParser', () => {
  beforeEach(() => {});

  it('should parse initialResponse combined', () => {
    const buf = toHex(
      rawCommands.response(),
      rawCommands.zero16(),
      rawCommands.zero16(),
      rawCommands.macAddress('00:07:A8:17:E9:AC'),
      rawCommands.zero16(),
      `00 00 00 00 00 00 00 13`,
      `ff ff 10 00 00 00 00 00`,
      `01 04 0f 5a 00 00 00 00`,
      `00 00 7e`,
      rawCommands.response(),
      rawCommands.zero16(),
      rawCommands.zero16(),
      rawCommands.macAddress('00:07:A8:17:E9:AC'),
      rawCommands.zero16(),
      `00 00 00 00 00 00 00 25`,
      `ff ff 22 00 00 00 00 00`,
      `01 06 6d 01 00 1a 00 00`,
      `00 7f 00 00 00 00 00 02`,
      `00 02 00 00 00 00 00 08`,
      `00 00 00 0e 4a`,
    );

    const res = parseState(buf);

    expect(res).toMatchSnapshot();
  });

  it('should parse initialResponse2', () => {
    const buf = toHex(
      rawCommands.response(),
      rawCommands.zero16(),
      rawCommands.zero16(),
      rawCommands.macAddress('00:07:A8:17:E9:AC'),
      rawCommands.zero16(),
      `00 00 00 0a 00 00 00 25`, // seq + len
      `ff ff 22 00 00 00 00 00 01 02 6d 01 00 15 00 00`,
      `00 7f 00 00 00 00 00 01 00 02 00 02 00 09 00 01`,
      `00 00 00 0a 40                                 `,
    );

    const res = parseState(buf);

    expect(res).toMatchSnapshot();
  });
});

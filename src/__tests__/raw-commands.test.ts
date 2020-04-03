import * as rawCommands from '../lib/raw-commands';

describe('raw-commands', () => {
  it('mac-address', () => {
    const a = rawCommands.macAddress('00:07:A8:17:E9:AC');

    expect(a).toMatchSnapshot();
  });
});

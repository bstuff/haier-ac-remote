import { hexy } from 'hexy';

import * as commands from '../lib/commands';

describe('commands', () => {
  it('should work', () => {
    const a = commands.on();

    expect(hexy(a)).toMatchSnapshot();
  });
});

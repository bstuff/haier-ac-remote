import { hexy } from 'hexy';

import * as commands from '../lib/commands';

describe('commands', () => {
  it('should work', () => {
    const a = commands.on('0007A8E917AC');

    expect(hexy(a)).toMatchSnapshot();
  });
});

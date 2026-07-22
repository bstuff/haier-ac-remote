import { createServer, Server, Socket } from 'net';

import { HaierAC } from '../HaierAC';
import * as rawCommands from '../lib/raw-commands';
import { toHex } from '../lib/toHex';

// A device state response whose seq byte (offset 75) echoes the request's seq,
// so the client's ACK matcher resolves the right command.
function responseForSeq(seq: number): Buffer {
  const f = Buffer.from(
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
  f[75] = seq;
  return f;
}

describe('HaierAC connection & command queue', () => {
  let server: Server;
  let port: number;
  let connections = 0;
  let received: Buffer[] = [];
  let respond: (sock: Socket, req: Buffer) => void;

  beforeEach(async () => {
    connections = 0;
    received = [];
    respond = (sock, req) => sock.write(responseForSeq(req[75]));

    server = createServer((sock) => {
      connections += 1;
      sock.on('data', (chunk) => {
        const req = chunk as Buffer;
        received.push(req);
        respond(sock, req);
      });
      sock.on('error', () => undefined);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function makeAC(overrides: Record<string, unknown> = {}): HaierAC {
    return new HaierAC({
      ip: '127.0.0.1',
      port,
      mac: '0007A8E917AC',
      autoConnect: false,
      timeout: 300,
      commandGap: 0,
      ...overrides,
    });
  }

  it('opens exactly one connection and ACKs a command', async () => {
    const ac = makeAC();
    const ok = await ac.on();
    expect(ok).toBe(true);
    expect(connections).toBe(1);
    ac.destroy();
  });

  it('serializes concurrent commands over a single connection (no reconnect storm)', async () => {
    const ac = makeAC();
    const results = await Promise.all([ac.on(), ac.refresh(), ac.off(), ac.refresh(), ac.on()]);
    expect(results.every(Boolean)).toBe(true);
    expect(connections).toBe(1); // single socket, not one-per-command
    expect(received.length).toBe(5); // every command actually delivered
    ac.destroy();
  });

  it('a slow response times out WITHOUT tearing down / reconnecting the link', async () => {
    const ac = makeAC({ timeout: 120 });

    respond = () => undefined; // server goes silent
    const slow = await ac.on();
    expect(slow).toBe(false); // request timed out
    expect(connections).toBe(1); // did NOT reconnect on a mere response timeout

    respond = (sock, req) => sock.write(responseForSeq(req[75]));
    const ok = await ac.refresh(); // same connection must still work
    expect(ok).toBe(true);
    expect(connections).toBe(1);
    ac.destroy();
  });

  it('changeState powers on once, then dedupes on() when already powered', async () => {
    const ac = makeAC();

    received = [];
    await ac.changeState({ targetTemperature: 24 }); // off -> on() + setState
    expect(received.length).toBe(2);

    received = [];
    await ac.changeState({ targetTemperature: 25 }); // already on -> setState only
    expect(received.length).toBe(1);

    ac.destroy();
  });

  it('reflects device state into state$', async () => {
    const ac = makeAC();
    await ac.refresh();
    expect(ac.state$.value.currentTemperature).toBe(21);
    expect(ac.state$.value.targetTemperature).toBe(28);
    expect(ac.state$.value.power).toBe(true);
    ac.destroy();
  });
});

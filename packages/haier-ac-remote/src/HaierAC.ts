import _debug from 'debug';
import { hexy } from 'hexy';
import { Socket } from 'net';
import { BehaviorSubject } from 'rxjs';

import { FanSpeed, Limits, Mode, State } from './_types';
import * as commands from './lib/commands';
import { extractFrames, parseState, TheParser } from './lib/parsers';

const debug = _debug('haier-ac');
const logRecv = debug.extend('recv');
const logSent = debug.extend('sent');
const logError = debug.extend('error');
const logState = debug.extend('state');
const logConn = debug.extend('conn');

const PORT = 56800;

const defaultState: State = {
  currentTemperature: 21,
  targetTemperature: 21,
  fanSpeed: FanSpeed.MIN,
  mode: Mode.FAN,
  health: false,
  limits: Limits.OFF,
  power: false,
  // Read-only telemetry / flags (keys must exist here so parseState values
  // survive the pickBy(keys.includes) merge in _applyState).
  outdoorTemperature: undefined,
  currentHumidity: undefined,
  airQuality: undefined,
  pmValue: undefined,
  auxHeat: false,
  auto: false,
  dehumidify: false,
  eco: false,
  childLock: false,
  freshAir: false,
  turbo: false,
  quiet: false,
};

const STATE_KEYS = Object.keys(defaultState);

type ConstructorOptions = {
  ip: string;
  mac: string;
  /** TCP port. Default 56800 (the Haier smart-link local port). */
  port?: number;
  /** Per-command response timeout, ms. Default 3000. */
  timeout?: number;
  /** Minimum gap between two outbound commands, ms. Default 150. */
  commandGap?: number;
  /** Connect immediately and keep reconnecting. Default true. */
  autoConnect?: boolean;
};

type ConnState = 'idle' | 'connecting' | 'connected';

type Pending = { seq: number; resolve: (ok: boolean) => void };

type Job = () => Promise<void>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref?.());

/**
 * Talks to a Haier "smart-link" AC over its local TCP socket (port 56800).
 *
 * Reliability model (see PROTOCOL-AUDIT / hang investigation):
 *  - Exactly ONE connection at a time; reconnection is single-flight with
 *    backoff and is the ONLY caller of socket.connect(). We never call connect()
 *    on a live socket (that throws EISCONN and would tear down a healthy link).
 *  - A slow command response NEVER triggers a reconnect (a slow reply is not a
 *    dead socket); reconnects happen only on real 'close'/'error'.
 *  - All commands are serialized through a single-flight queue with a small gap
 *    so a HomeKit setter burst can never flood the fragile module.
 *  - Incoming TCP bytes are buffered and split into whole frames, so a frame
 *    spanning two 'data' events is reassembled rather than dropped.
 */
export class HaierAC {
  readonly ip: string;
  readonly port: number;
  readonly mac: string;
  readonly timeout: number;
  readonly commandGap: number;

  state$ = new BehaviorSubject<State>(defaultState);

  protected _seq = 0;
  protected _socket: Socket | null = null;
  protected _parser = new TheParser();
  protected _rxBuffer: Buffer = Buffer.alloc(0);
  protected _connState: ConnState = 'idle';
  protected _connectPromise: Promise<Socket> | null = null;
  protected _reconnectAttempts = 0;
  protected _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected _destroyed = false;
  protected _hasConnected = false;

  protected _queue: Job[] = [];
  protected _draining = false;
  protected _pending: Pending | null = null;

  constructor(options: ConstructorOptions) {
    const { ip, mac, port = PORT, timeout = 3000, commandGap = 150, autoConnect = true } = options;

    this.ip = ip;
    this.mac = mac;
    this.port = port;
    this.timeout = timeout;
    this.commandGap = commandGap;

    this.state$.subscribe(logState);

    if (autoConnect) {
      // A one-shot query on startup gives deterministic initial state and also
      // establishes the connection.
      this.refresh().catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  on(): Promise<boolean> {
    return this._enqueue(({ send }) => send((seq) => commands.on(this.mac, seq)));
  }

  off(): Promise<boolean> {
    return this._enqueue(({ send }) => send((seq) => commands.off(this.mac, seq)));
  }

  /** Ask the device to report its current state (4d01 query-status). */
  refresh(): Promise<boolean> {
    return this._enqueue(({ send }) => send((seq) => commands.hello(this.mac, seq)));
  }

  async changeState(
    newState: Partial<Omit<State, 'power' | 'currentTemperature'>>,
  ): Promise<boolean> {
    const next = { ...newState };

    if (typeof next.targetTemperature === 'number') {
      let t = next.targetTemperature;
      if (t < 16) t = 16;
      if (t > 30) t = 30;
      next.targetTemperature = Math.round(t);
    }

    return this._enqueue(async ({ send }) => {
      // Runs serially, so state$ already reflects any prior queued command —
      // this both dedupes redundant on() and avoids stale read-modify-write.
      if (!this.state$.value.power) {
        await send((seq) => commands.on(this.mac, seq));
      }

      return send((seq) => commands.setState(this.mac, { ...this.state$.value, ...next }, seq));
    });
  }

  /** Tear down the connection and stop reconnecting. */
  destroy(): void {
    this._destroyed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._teardownSocket();
    this._connState = 'idle';
    if (this._pending) {
      const p = this._pending;
      this._pending = null;
      p.resolve(false);
    }
    this._queue = [];
  }

  // -------------------------------------------------------------------------
  // Command queue (single in-flight command, paced)
  // -------------------------------------------------------------------------

  protected _enqueue<T>(
    job: (ctx: { send: (build: (seq: number) => Buffer) => Promise<boolean> }) => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      this._queue.push(async () => {
        let socket: Socket;
        try {
          socket = await this._ensureConnected();
        } catch {
          resolve(undefined as unknown as T);
          return;
        }

        const send = (build: (seq: number) => Buffer) => {
          const seq = this._nextSeq();
          return this._writeAndWait(socket, build(seq), seq);
        };

        try {
          resolve(await job({ send }));
        } catch (err) {
          logError(err instanceof Error ? err.message : String(err));
          resolve(undefined as unknown as T);
        }
      });
      void this._drain();
    });
  }

  protected async _drain(): Promise<void> {
    if (this._draining) return;
    this._draining = true;
    try {
      while (this._queue.length && !this._destroyed) {
        const job = this._queue.shift() as Job;
        await job();
        if (this.commandGap > 0 && this._queue.length) {
          await delay(this.commandGap);
        }
      }
    } finally {
      this._draining = false;
    }
  }

  protected _nextSeq(): number {
    const seq = this._seq;
    this._seq = (this._seq + 1) % 256;
    return seq;
  }

  protected _writeAndWait(socket: Socket, cmd: Buffer, seq: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this._pending && this._pending.seq === seq) this._pending = null;
        resolve(ok);
      };

      const timer = setTimeout(() => finish(false), this.timeout);
      timer.unref?.();

      // Only one command is ever in flight, so a single pending slot is enough.
      this._pending = { seq, resolve: finish };

      try {
        logSent(hexy(cmd, { format: 'twos' }));
        socket.write(cmd);
      } catch {
        finish(false);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Connection management (single-flight, fresh socket, backoff)
  // -------------------------------------------------------------------------

  protected _ensureConnected(): Promise<Socket> {
    if (this._destroyed) return Promise.reject(new Error('destroyed'));
    if (this._connState === 'connected' && this._socket) return Promise.resolve(this._socket);
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = new Promise<Socket>((resolve, reject) => {
      this._connState = 'connecting';
      const socket = new Socket();
      let settled = false;

      const connectTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        logConn('connect timeout');
        socket.destroy();
        this._connState = 'idle';
        this._connectPromise = null;
        reject(new Error('connect timeout'));
        this._scheduleReconnect();
      }, this.timeout);
      connectTimer.unref?.();

      socket.once('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        logConn('connect error', err.message);
        socket.destroy();
        this._connState = 'idle';
        this._connectPromise = null;
        reject(err);
        this._scheduleReconnect();
      });

      socket.connect(this.port, this.ip, () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        this._connState = 'connected';
        this._connectPromise = null;
        this._reconnectAttempts = 0;
        this._rxBuffer = Buffer.alloc(0);
        this._bindSocket(socket);
        this._socket = socket;
        logConn('connected');

        const wasReconnect = this._hasConnected;
        this._hasConnected = true;
        resolve(socket);

        // Re-sync state after a reconnect (the initial connect is already driven
        // by the constructor's refresh()).
        if (wasReconnect) this.refresh().catch(() => undefined);
      });
    });

    return this._connectPromise;
  }

  protected _bindSocket(socket: Socket): void {
    socket.on('data', (data: Buffer) => this._onData(data));
    socket.on('error', (err) => logConn('socket error', err.message));
    socket.on('close', () => {
      if (this._socket !== socket) return; // stale socket, ignore
      logConn('socket closed');
      this._socket = null;
      this._connState = 'idle';
      if (this._pending) {
        const p = this._pending;
        this._pending = null;
        p.resolve(false);
      }
      this._scheduleReconnect();
    });
  }

  protected _teardownSocket(): void {
    const socket = this._socket;
    this._socket = null;
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
    }
  }

  protected _scheduleReconnect(): void {
    if (this._destroyed || this._reconnectTimer || this._connState !== 'idle') return;

    const base = Math.min(30000, 1000 * 2 ** this._reconnectAttempts);
    const wait = base + Math.floor(Math.random() * 500);
    this._reconnectAttempts += 1;
    logConn(`reconnect in ${wait}ms (attempt ${this._reconnectAttempts})`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._ensureConnected()
        .then(() => this._drain())
        .catch(() => undefined);
    }, wait);
    this._reconnectTimer.unref?.();
  }

  // -------------------------------------------------------------------------
  // Incoming data → frames → state / ACK
  // -------------------------------------------------------------------------

  protected _onData(data: Buffer): void {
    logRecv(hexy(data, { format: 'twos' }));
    this._rxBuffer = Buffer.concat([this._rxBuffer, data]);

    const { frames, rest } = extractFrames(this._rxBuffer);
    this._rxBuffer = rest;

    for (const frame of frames) {
      let results;
      try {
        results = this._parser.parse(frame);
      } catch (err) {
        logError(err instanceof Error ? err.message : String(err));
        continue;
      }

      for (const r of results) {
        // Apply state BEFORE resolving the ACK, so a caller awaiting the command
        // sees the fresh state$ (e.g. changeState's power dedupe).
        const out = parseState([r]);
        if (out) this._applyState(out.state);

        // Match the in-flight command by its echoed seq. Safe with a single
        // in-flight command (serialized queue) and a per-instance parser.
        if (this._pending && r.seq === this._pending.seq) {
          const p = this._pending;
          this._pending = null;
          p.resolve(true);
        }
      }
    }
  }

  protected _applyState(state: Record<string, unknown>): void {
    const known: Record<string, unknown> = {};
    for (const key of STATE_KEYS) {
      if (key in state) known[key] = state[key];
    }
    this.state$.next({ ...this.state$.value, ...known });
  }
}

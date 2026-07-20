import _debug from 'debug';
import { hexy } from 'hexy';
import pickBy from 'lodash/pickBy';
import { Socket } from 'net';
import {
  BehaviorSubject,
  from,
  fromEvent,
  Subject,
  throwError,
  firstValueFrom,
  lastValueFrom,
} from 'rxjs';
import { filter, map, take, timeout, catchError } from 'rxjs/operators';

import { FanSpeed, Limits, Mode, State } from './_types';
import * as commands from './lib/commands';
import { parseState, TheParser, TheParserResult } from './lib/parsers';

const debug = _debug('haier-ac');
const logReceived = debug.extend('recv');
const logSent = debug.extend('sent');
const logError = debug.extend('error');
const logState = debug.extend('state');

function send(cl: Socket, buf: Buffer) {
  cl.write(buf);
  logSent(
    hexy(buf, {
      format: 'twos',
    }),
  );
}

function recv(buf: Buffer) {
  logReceived(
    hexy(buf, {
      format: 'twos',
    }),
  );
}

const theParser = new TheParser();

const defaultState: State = {
  currentTemperature: 21,
  targetTemperature: 21,
  fanSpeed: FanSpeed.MIN,
  mode: Mode.FAN,
  health: false,
  limits: Limits.OFF,
  power: false,
};

type ConstructorOptions = {
  ip: string;
  mac: string;
  timeout?: number;
};

export class HaierAC {
  ip: string;
  port = 56800;
  mac: string;
  timeout: number;
  protected _rawData$ = new Subject<Buffer>();
  protected _client = new Socket();
  state$ = new BehaviorSubject<State>(defaultState);
  protected _seq = 0;

  constructor(options: ConstructorOptions) {
    const { ip, mac, timeout = 500 } = options;

    this.ip = ip;
    this.mac = mac;
    this.timeout = timeout;

    this._client.setTimeout(this.timeout);

    this._rawData$.subscribe((data) => {
      recv(data);

      try {
        const resp = theParser.parse(data);
        const response = parseState(resp);
        if (!response) return;
        const { state } = response;

        if (state) {
          const keys = Object.keys(defaultState);
          const nextStateRaw = {
            ...this.state$.value,
            ...pickBy(state, (_, key) => keys.includes(key)),
          };

          this.state$.next(nextStateRaw);
        }
      } catch (error) {
        logError(error instanceof Error ? error.message : String(error));
      }
    });

    this._connect().catch(logError);
    this._client.on('error', logError);
    this._client.on('data', (data: Buffer) => {
      this._rawData$.next(data);
    });
    this._client.on('close', (err) => {
      if (!err) {
        this._connect().catch(logError);
      }

      logError('Connection closed>>>');
    });

    this.state$.subscribe(logState);
  }

  protected _connect() {
    return lastValueFrom(
      from(
        new Promise<void>((resolve) => {
          this._client.connect(this.port, this.ip, () => resolve());
        }),
      ).pipe(
        timeout(this.timeout),
        catchError((err) =>
          throwError(() => (err.name === 'TimeoutError' ? 'connection timeout error' : err)),
        ),
      ),
    );
  }

  protected hello() {
    return this._sendRequest((seq) => commands.hello(this.mac, seq));
  }

  protected init() {
    return this._sendRequest((seq) => commands.init(this.mac, seq));
  }

  on() {
    return this._sendRequest((seq) => commands.on(this.mac, seq));
  }

  off() {
    return this._sendRequest((seq) => commands.off(this.mac, seq));
  }

  async changeState(newState: Partial<Omit<State, 'power' | 'currentTemperature'>>) {
    if (!this.state$.value.power) {
      await this.on();
    }

    let { targetTemperature = 0 } = newState;
    if (targetTemperature < 16) {
      targetTemperature = 16;
    }

    if (targetTemperature > 30) {
      targetTemperature = 30;
    }

    targetTemperature = Math.round(targetTemperature);

    if (newState.targetTemperature) {
      newState.targetTemperature = targetTemperature;
    }

    return this._sendRequest((seq) =>
      commands.setState(
        this.mac,
        {
          ...this.state$.value,
          ...newState,
        },
        seq,
      ),
    );
  }

  protected _sendRequest(createCommand: (s: number) => Buffer) {
    const seq = this._seq;
    const cmd = createCommand(seq);

    const o$ = fromEvent<TheParserResult>(theParser, 'parseCompleted').pipe(
      filter((v) => v.seq === seq),
      take(1),
      map(() => true as const),
      timeout(this.timeout),
    );

    this._seq = (this._seq + 1) % 256;
    send(this._client, cmd);

    return firstValueFrom(o$).catch(() => {
      this._connect().catch(logError);

      return false;
    });
  }
}

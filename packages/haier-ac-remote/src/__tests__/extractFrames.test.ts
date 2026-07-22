import { extractFrames } from '../lib/parsers';
import * as rawCommands from '../lib/raw-commands';
import { toHex } from '../lib/toHex';

// A complete 117-byte device response frame (00 00 27 15 header + 76 + inner37).
function sampleFrame(): Buffer {
  return toHex(
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
  );
}

describe('extractFrames (TCP stream reassembly)', () => {
  it('extracts a single complete frame with no leftover', () => {
    const frame = sampleFrame();
    const { frames, rest } = extractFrames(frame);
    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(117);
    expect(rest.length).toBe(0);
  });

  it('reassembles a frame split across two chunks (the dropped-frame bug)', () => {
    const frame = sampleFrame();
    const a = frame.subarray(0, 50);
    const b = frame.subarray(50);

    const first = extractFrames(a);
    expect(first.frames).toHaveLength(0); // incomplete — must NOT be dropped
    expect(first.rest.length).toBe(50);

    const second = extractFrames(Buffer.concat([first.rest, b]));
    expect(second.frames).toHaveLength(1);
    expect(second.frames[0].length).toBe(117);
    expect(second.rest.length).toBe(0);
  });

  it('splits two coalesced frames arriving in one chunk', () => {
    const two = Buffer.concat([sampleFrame(), sampleFrame()]);
    const { frames, rest } = extractFrames(two);
    expect(frames).toHaveLength(2);
    expect(rest.length).toBe(0);
  });

  it('resynchronises past leading junk bytes', () => {
    const junk = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00]);
    const { frames } = extractFrames(Buffer.concat([junk, sampleFrame()]));
    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(117);
  });

  it('keeps a trailing partial header for the next chunk', () => {
    const buf = Buffer.concat([sampleFrame(), Buffer.from([0x00, 0x00, 0x27])]);
    const { frames, rest } = extractFrames(buf);
    expect(frames).toHaveLength(1);
    expect([...rest]).toEqual([0x00, 0x00, 0x27]); // partial next header retained
  });
});

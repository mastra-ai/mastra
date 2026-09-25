import { describe, expect, it, vi } from 'vitest';
import { decodeGetSecretRequest, encodeGetSecretResponse, openBuildSession } from './build-session';

describe('openBuildSession', () => {
  it('rejects pre-aborted sessions without dialing Docker', async () => {
    const dial = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(
      Promise.resolve().then(() =>
        openBuildSession({ modem: { dial } } as never, { TOKEN: 'secret' }, controller.signal),
      ),
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(dial).not.toHaveBeenCalled();
  });

  it('rejects an in-flight dial with the custom abort reason and closes a late socket', async () => {
    let callback!: (error: Error | null, socket?: unknown) => void;
    const dial = vi.fn((_options, cb) => {
      callback = cb;
    });
    const controller = new AbortController();
    const reason = new Error('request cancelled');
    const session = openBuildSession({ modem: { dial } } as never, { TOKEN: 'secret' }, controller.signal);
    controller.abort(reason);
    await expect(session).rejects.toMatchObject({ code: 'ABORTED', cause: reason });
    const socket = { end: vi.fn() };
    callback(null, socket);
    expect(socket.end).toHaveBeenCalledTimes(1);
  });
});

describe('build session wire format', () => {
  it('decodes GetSecretRequest.ID and skips unknown fields', () => {
    // ID = "GH_TOKEN" (field 1), annotations map entry (field 2), an unknown varint (field 9).
    const id = Buffer.from('GH_TOKEN');
    const entry = Buffer.concat([Buffer.from([0x0a, 1, 0x6b, 0x12, 1, 0x76])]);
    const wire = Buffer.concat([
      Buffer.from([0x0a, id.length]),
      id,
      Buffer.from([0x12, entry.length]),
      entry,
      Buffer.from([0x48, 0x01]),
    ]);
    expect(decodeGetSecretRequest(wire)).toEqual({ id: 'GH_TOKEN' });
    expect(decodeGetSecretRequest(Buffer.alloc(0))).toEqual({ id: '' });
  });

  it('encodes GetSecretResponse.data with a multi-byte varint length', () => {
    const data = Buffer.alloc(300, 0x61);
    const wire = encodeGetSecretResponse({ data });
    expect([...wire.subarray(0, 3)]).toEqual([0x0a, 0xac, 0x02]);
    expect(wire.subarray(3).equals(data)).toBe(true);
  });
});

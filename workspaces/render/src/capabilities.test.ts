import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { Render } from '@renderinc/sdk';
import { describe, expect, it, vi } from 'vitest';
import { RenderSandbox } from './sandbox.js';

const remote = {
  id: 'sbx-features',
  status: 'running',
  createdAt: '2026-10-09T00:00:00Z',
  plan: 'starter',
  region: 'oregon',
  timeoutSeconds: 900,
  networkPolicy: { default: 'deny-all' },
} as const;
const snapshot = {
  id: 'snp-test',
  sandboxGroupId: 'sbg-test',
  sourceSandboxId: remote.id,
  kind: 'filesystem',
  status: 'available',
  plan: 'starter',
  name: 'prepared',
  error: null,
} as const;
function setup(extra: ConstructorParameters<typeof RenderSandbox>[0] = {}) {
  const client = new Render({ token: 'test', ownerId: 'tea-test' });
  const api = client.experimental.sandboxes;
  const create = vi.spyOn(api, 'create').mockResolvedValue(remote as any);
  vi.spyOn(api, 'get').mockResolvedValue(remote as any);
  const terminate = vi.spyOn(api, 'terminate').mockResolvedValue();
  const exec = vi.spyOn(api, 'exec').mockImplementation(async () =>
    (async function* () {
      yield { type: 'exit', exit_code: 0 } as const;
    })(),
  );
  const sandbox = new RenderSandbox({ client, pollIntervalMs: 1, controlTimeoutMs: 100, ...extra });
  return { client, api, sandbox, create, terminate, exec };
}
function output(data: string, code = 0) {
  return (async function* () {
    yield { type: 'output', stream: 'stdout', data } as const;
    yield { type: 'exit', exit_code: code } as const;
  })();
}

describe('snapshot lifecycle', () => {
  it('captures, polls, restores runtime plan, and deletes without destroying source', async () => {
    const h = setup();
    const capture = vi
      .spyOn(h.api.snapshots, 'create')
      .mockResolvedValue({ ...snapshot, kind: 'runtime', status: 'creating' } as any);
    vi.spyOn(h.api.snapshots, 'get').mockResolvedValue({ ...snapshot, kind: 'runtime' } as any);
    const remove = vi.spyOn(h.api.snapshots, 'delete').mockResolvedValue();
    const saved = await h.sandbox.captureSnapshot({ kind: 'runtime', name: 'prepared' });
    expect(capture).toHaveBeenCalledWith({
      sandboxId: remote.id,
      ownerId: undefined,
      kind: 'runtime',
      name: 'prepared',
    });
    const restored = h.sandbox.restore(saved);
    await restored.start();
    expect(h.create.mock.calls[1]?.[0]).toMatchObject({ snapshotId: 'snp-test', plan: 'starter' });
    expect(() => h.sandbox.restore(saved, { create: { plan: 'pro' } })).toThrow('original plan');
    await h.sandbox.snapshots.delete({ sandboxGroupId: 'sbg-test', snapshotId: 'snp-test' });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(h.terminate).not.toHaveBeenCalled();
    await restored.destroy();
    await h.sandbox.destroy();
  });
  it('retains failed and timed-out capture identities, without creating again', async () => {
    const h = setup();
    const create = vi.spyOn(h.api.snapshots, 'create').mockResolvedValue({ ...snapshot, status: 'creating' } as any);
    const get = vi
      .spyOn(h.api.snapshots, 'get')
      .mockResolvedValue({ ...snapshot, status: 'failed', error: 'capture failed' } as any);
    await expect(h.sandbox.captureSnapshot()).rejects.toMatchObject({
      code: 'STATE',
      details: { snapshotId: 'snp-test' },
    });
    get.mockResolvedValue({ ...snapshot, status: 'creating' } as any);
    await expect(h.sandbox.captureSnapshot({}, { timeoutMs: 10 })).rejects.toMatchObject({
      details: { snapshotId: 'snp-test' },
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(h.sandbox.snapshots.lastCreated?.id).toBe('snp-test');
    expect(h.sandbox.status).toBe('running');
    await h.sandbox.destroy();
  });
  it('coalesces Mastra checkpoint calls and uses the requested checkpoint name', async () => {
    const h = setup({ checkpointName: 'my-checkpoint' });
    const create = vi.spyOn(h.api.snapshots, 'create').mockResolvedValue(snapshot as any);
    await Promise.all([h.sandbox.snapshot(), h.sandbox.snapshot()]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].name).toBe('my-checkpoint');
    await h.sandbox.destroy();
  });
  it('keeps the eventual receipt if a capture response arrives after the caller deadline', async () => {
    const h = setup();
    let resolve!: (value: any) => void;
    vi.spyOn(h.api.snapshots, 'create').mockReturnValue(
      new Promise(r => {
        resolve = r;
      }),
    );
    await expect(h.sandbox.snapshots.create({ sandboxId: remote.id }, { timeoutMs: 5 })).rejects.toBeDefined();
    const pending = [...h.sandbox.snapshots.pendingCreates];
    resolve(snapshot);
    await Promise.all(pending);
    expect(h.sandbox.snapshots.lastCreated?.id).toBe('snp-test');
  });
});

describe('file and resource APIs', () => {
  it('streams uploads, forwards archive content type, and imposes only an explicitly configured size limit', async () => {
    const h = setup();
    let received = Buffer.alloc(0);
    const upload = vi.spyOn(h.api, 'upload').mockImplementation(async (_id, _path, data) => {
      const chunks = [];
      for await (const chunk of data as Readable) chunks.push(Buffer.from(chunk));
      received = Buffer.concat(chunks);
    });
    await h.sandbox.upload('/folder', Readable.from(['abc', 'def']), { contentType: 'application/x-tar' });
    expect(received.toString()).toBe('abcdef');
    expect(upload.mock.calls[0]?.[4]?.contentType).toBe('application/x-tar');
    expect(h.exec.mock.calls[0]?.[1]).toContain("mkdir -p -- '/folder'");
    await h.sandbox.destroy();
    const bounded = setup({ maxFileBytes: 3 });
    vi.spyOn(bounded.api, 'upload').mockImplementation(async (_id, _path, data) => {
      for await (const _ of data as Readable) {
      }
    });
    await expect(bounded.sandbox.upload('/x', Readable.from(['ab', 'cd']))).rejects.toMatchObject({
      code: 'FILE_LIMIT',
    });
    expect(bounded.terminate).not.toHaveBeenCalled();
    await bounded.sandbox.destroy();
  });
  it('transfers larger than 16 MiB and preserves download metadata', async () => {
    const h = setup();
    const bytes = Buffer.alloc(17 * 1024 * 1024, 7);
    vi.spyOn(h.api, 'upload').mockResolvedValue();
    vi.spyOn(h.api, 'download').mockResolvedValue({
      data: bytes,
      size: bytes.length,
      contentType: 'application/octet-stream',
    });
    await h.sandbox.writeFiles([{ path: '/large', content: bytes }]);
    const result = await h.sandbox.download('/large');
    expect(result.data).toBe(bytes);
    expect(result.size).toBe(bytes.length);
    expect(result.contentType).toBe('application/octet-stream');
    await h.sandbox.destroy();
  });
  it('forwards pagination and ownership; refresh returns full remote metadata', async () => {
    const h = setup({ ownerId: 'tea-explicit' });
    const list = vi.spyOn(h.api, 'list').mockResolvedValue([]);
    const groups = vi.spyOn(h.api, 'listGroups').mockResolvedValue([]);
    await h.sandbox.listSandboxes({ status: ['terminated'], cursor: 'next', limit: 5 });
    await h.sandbox.listGroups();
    expect(list).toHaveBeenCalledWith({
      ownerId: 'tea-explicit',
      status: ['terminated'],
      cursor: 'next',
      limit: 5,
    });
    expect(groups).toHaveBeenCalledWith({ ownerId: 'tea-explicit' });
    await h.sandbox.start();
    expect(await h.sandbox.refresh()).toEqual(remote);
    expect(h.sandbox.sdk).toBe(h.api);
    await h.sandbox.destroy();
  });
  it('detach is non-destructive; explicit terminate can stop an attached sandbox', async () => {
    const h = setup({ sandboxId: remote.id });
    await h.sandbox.start();
    await h.sandbox.destroy();
    expect(h.terminate).not.toHaveBeenCalled();
    await h.sandbox.terminate();
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('observation cancellation keeps the adapter usable and does not kill the sandbox', async () => {
    const h = setup({ cancellationMode: 'observe' });
    const abort = new AbortController();
    h.exec.mockImplementationOnce(async () =>
      (async function* () {
        abort.abort();
        yield { type: 'exit', exit_code: 0 } as const;
      })(),
    );
    await expect(h.sandbox.executeCommand('sleep', [], { abortSignal: abort.signal })).rejects.toMatchObject({
      code: 'ABORTED',
    });
    expect(h.sandbox.status).toBe('running');
    expect((await h.sandbox.executeCommand('true')).success).toBe(true);
    expect(h.terminate).not.toHaveBeenCalled();
    await h.sandbox.destroy();
  });
});

describe('command termination confirmation', () => {
  it.each([false, true])('only publishes killed after supervisor confirmation (failure=%s)', async failure => {
    const h = setup();
    const abort = new AbortController();
    let release!: () => void;
    const stopped = new Promise<void>(resolve => {
      release = resolve;
    });
    h.exec.mockImplementation(async (_id, command) => {
      if (command.includes('Supervisor did not confirm')) {
        const token = command.match(/'([0-9a-f-]{36})' '(?:abort|timeout|stream)'/)?.[1];
        release();
        return output(JSON.stringify({ token, killed: true, timedOut: false }), failure ? 1 : 0);
      }
      if (command.startsWith('rm -rf')) return output('');
      return (async function* () {
        yield { type: 'output', stream: 'stdout', data: 'started' } as const;
        await stopped;
        yield { type: 'exit', exit_code: 137 } as const;
      })();
    });
    const pending = h.sandbox.executeCommand('sleep 60', [], {
      abortSignal: abort.signal,
      onStdout: () => abort.abort(),
    });
    if (failure) await expect(pending).rejects.toMatchObject({ details: { remoteMayBeRunning: true } });
    else
      expect(await pending).toMatchObject({
        exitCode: 137,
        killed: true,
        timedOut: false,
        stdout: 'started',
      });
    expect(h.sandbox.status).toBe('running');
    expect(h.terminate).not.toHaveBeenCalled();
    await h.sandbox.destroy();
  });
});

describe('concurrent lifecycle and failure boundaries', () => {
  it('an aborted readiness waiter does not cancel another caller’s provisioning', async () => {
    const h = setup();
    let finish!: (value: any) => void;
    h.create.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const abort = new AbortController();
    const canceled = h.sandbox.start({ abortSignal: abort.signal });
    const waiting = h.sandbox.start();
    abort.abort(new Error('caller stopped waiting'));
    await expect(canceled).rejects.toThrow('caller stopped waiting');
    finish(remote);
    await waiting;
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.sandbox.status).toBe('running');
    await h.sandbox.destroy();
  });
  it('distinguishes an aborted snapshot wait from a timeout and preserves ownership override', async () => {
    const h = setup({ ownerId: 'tea-default' });
    vi.spyOn(h.api.snapshots, 'create').mockResolvedValue({ ...snapshot, status: 'creating' } as any);
    const get = vi.spyOn(h.api.snapshots, 'get').mockResolvedValue(snapshot as any);
    await h.sandbox.snapshots.capture({ sandboxId: remote.id, ownerId: 'tea-another' });
    expect(get.mock.calls[0]?.[0].ownerId).toBe('tea-another');
    const abort = new AbortController();
    abort.abort();
    await expect(
      h.sandbox.snapshots.waitForAvailable(snapshot as any, { abortSignal: abort.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', details: { snapshotId: snapshot.id } });
  });
  it.each([true, false])(
    'restores a checkpoint, falls back to a seed, or starts fresh (available=%s)',
    async available => {
      const h = setup();
      vi.spyOn(h.api, 'listGroups').mockResolvedValue([{ sandboxGroup: { id: 'sbg-test' }, cursor: 'group' }] as any);
      vi.spyOn(h.api.snapshots, 'list').mockResolvedValue(
        available ? ([{ snapshot: { ...snapshot, name: 'seed' }, cursor: 'snap' }] as any) : [],
      );
      const cloned = h.sandbox.clone({
        checkpointName: 'new-tenant',
        seedCheckpointName: 'seed',
        env: { EXPLICIT: 'yes' },
      });
      await cloned.start();
      expect(h.create.mock.calls[0]?.[0]).toMatchObject({ env: { EXPLICIT: 'yes' } });
      expect(h.create.mock.calls[0]?.[0]?.snapshotId).toBe(available ? snapshot.id : undefined);
      await cloned.destroy();
    },
  );
  it('retains an explicit base snapshot when cloning without a checkpoint override', async () => {
    const h = setup({ create: { snapshotId: 'snp-base', plan: 'standard' } });
    const cloned = h.sandbox.clone();
    await cloned.start();
    expect(h.create.mock.calls[0]?.[0]).toMatchObject({ snapshotId: 'snp-base', plan: 'standard' });
    await cloned.destroy();
  });
  it('a stream error during provisioning rejects the transfer without an unhandled error', async () => {
    const h = setup();
    const source = new Readable({ read() {} });
    const pending = h.sandbox.upload('/file', source);
    source.destroy(new Error('local read failure'));
    await expect(pending).rejects.toMatchObject({ cause: { message: 'local read failure' } });
    expect(source.destroyed).toBe(true);
    expect(h.sandbox.status).toBe('running');
    await h.sandbox.destroy();
  });
  it('destroys an owned resource even if a native iterator is abandoned between events', async () => {
    const h = setup({ controlTimeoutMs: 5 });
    h.exec.mockResolvedValue(output('part'));
    const stream = h.sandbox.exec('native command');
    await stream.next();
    await h.sandbox.destroy();
    expect(h.terminate).toHaveBeenCalledTimes(1);
    await stream.return();
  });
  it('a natural exit racing abort is not falsely reported as killed', async () => {
    const h = setup();
    const abort = new AbortController();
    h.exec.mockImplementation(async (_id, command) => {
      if (command.includes('Supervisor did not confirm')) {
        const token = command.match(/'([0-9a-f-]{36})' '(?:abort|timeout|stream)'/)?.[1];
        return output(JSON.stringify({ token, killed: false, timedOut: false }));
      }
      return output('done');
    });
    const result = await h.sandbox.executeCommand('true', [], {
      abortSignal: abort.signal,
      onStdout: () => abort.abort(),
    });
    expect(result).toMatchObject({ exitCode: 0, success: true, killed: false, timedOut: false });
    await h.sandbox.destroy();
  });
});

describe('archive compatibility', () => {
  it.each([false, true])('streams gzip decompression to the supported tar content type (stream=%s)', async stream => {
    const h = setup();
    const bytes = Buffer.from('archive contents');
    const received: Buffer[] = [];
    const upload = vi.spyOn(h.api, 'upload').mockImplementation(async (_id, _path, data) => {
      for await (const chunk of data as Readable) received.push(Buffer.from(chunk));
    });
    const compressed = gzipSync(bytes);
    await h.sandbox.upload('/directory', stream ? Readable.from([compressed]) : compressed, {
      contentType: 'application/gzip',
    });
    expect(Buffer.concat(received)).toEqual(bytes);
    expect(upload.mock.calls[0]?.[4]?.contentType).toBe('application/x-tar');
    await h.sandbox.destroy();
  });
  it('rejects malformed gzip and preserves a reusable sandbox', async () => {
    const h = setup();
    vi.spyOn(h.api, 'upload').mockImplementation(async (_id, _path, data) => {
      for await (const _ of data as Readable) {
      }
    });
    await expect(
      h.sandbox.upload('/directory', Buffer.from('bad gzip'), { contentType: 'application/gzip' }),
    ).rejects.toMatchObject({ cause: { code: 'Z_DATA_ERROR' } });
    expect(h.sandbox.status).toBe('running');
    expect(h.terminate).not.toHaveBeenCalled();
    await h.sandbox.destroy();
  });
});

it('invalid native-stream timeouts leave no operation to drain', async () => {
  const h = setup({ sandboxId: remote.id, controlTimeoutMs: 5 });
  const stream = h.sandbox.exec('true', { timeoutMs: -1 });
  await expect(stream.next()).rejects.toMatchObject({ code: 'CONFIGURATION' });
  await expect(h.sandbox.destroy()).resolves.toBeUndefined();
  expect(h.exec).not.toHaveBeenCalled();
});

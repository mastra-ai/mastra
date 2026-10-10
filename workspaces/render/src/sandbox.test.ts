import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Workspace } from '@mastra/core/workspace';
import { Render, ClientError } from '@renderinc/sdk';
import { describe, expect, it, vi } from 'vitest';
import { renderSandboxProvider } from './provider.js';
import { RenderSandbox } from './sandbox.js';
import type { RenderSandboxOptions } from './sandbox.js';
import { OutputTail } from './utils.js';

const remote = { id: 'sbx-test', status: 'running', createdAt: '2026-10-09T00:00:00Z' } as Awaited<
  ReturnType<Render['experimental']['sandboxes']['create']>
>;
type Event = { type: 'output'; stream: 'stdout' | 'stderr'; data: string } | { type: 'exit'; exit_code: number };
async function* events(...values: Event[]) {
  yield* values;
}
const out = (data: string): Event => ({ type: 'output', stream: 'stdout', data });
const exit = (exit_code = 0): Event => ({ type: 'exit', exit_code });
function setup(options: RenderSandboxOptions = {}) {
  const client = new Render({ token: 'test-token', ownerId: 'tea-test' });
  const api = client.experimental.sandboxes;
  const create = vi.spyOn(api, 'create').mockResolvedValue(remote);
  const get = vi.spyOn(api, 'get').mockResolvedValue(remote);
  const exec = vi.spyOn(api, 'exec').mockImplementation(async () => events(exit()));
  const terminate = vi.spyOn(api, 'terminate').mockResolvedValue();
  const upload = vi.spyOn(api, 'upload').mockResolvedValue();
  const download = vi.spyOn(api, 'download').mockResolvedValue({ data: Buffer.from('hi'), size: 2 });
  const sandbox = new RenderSandbox({
    client,
    cancellationMode: 'terminate',
    pollIntervalMs: 1,
    readyTimeoutMs: 100,
    controlTimeoutMs: 30,
    ...options,
  });
  return { sandbox, client, api, create, get, exec, terminate, upload, download };
}
function gate<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { resolve, promise };
}

describe('creation and ownership', () => {
  it('uses public Workspace lifecycle with bounded lifetime and deny-all defaults', async () => {
    const h = setup();
    const workspace = new Workspace({ sandbox: h.sandbox });
    await workspace.init();
    expect(h.create).toHaveBeenCalledWith({ timeoutSeconds: 900, networkPolicy: { default: 'deny-all' } });
    expect(h.sandbox.status).toBe('running');
    expect(h.sandbox.sandboxId).toBe('sbx-test');
    await workspace.destroy();
    expect(h.terminate).toHaveBeenCalledTimes(1);
    expect(h.sandbox.status).toBe('destroyed');
  });
  it('coalesces concurrent starts and destroys', async () => {
    const h = setup();
    await Promise.all([h.sandbox.start(), h.sandbox.start(), h.sandbox.start()]);
    await Promise.all([h.sandbox.destroy(), h.sandbox.destroy()]);
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('waits through creating', async () => {
    const h = setup();
    h.get.mockResolvedValueOnce({ ...remote, status: 'creating' });
    await h.sandbox.start();
    expect(h.get).toHaveBeenCalledTimes(2);
    await h.sandbox.destroy();
  });
  it('terminates an owned sandbox after readiness timeout', async () => {
    const h = setup({ readyTimeoutMs: 15 });
    h.get.mockResolvedValue({ ...remote, status: 'creating' });
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('cleans up terminal readiness failure', async () => {
    const h = setup();
    h.get.mockResolvedValue({ ...remote, status: 'errored' });
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'STATE' });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('never retries uncertain creation', async () => {
    const h = setup();
    h.create.mockRejectedValue(new Error('connection lost'));
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'STREAM' });
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'STATE' });
    expect(h.create).toHaveBeenCalledTimes(1);
    await expect(h.sandbox.destroy()).rejects.toMatchObject({ code: 'CLEANUP' });
  });
  it('captures and cleans up a late successful create after its deadline', async () => {
    const h = setup({ readyTimeoutMs: 10 });
    const pending = gate<typeof remote>();
    h.create.mockReturnValue(pending.promise);
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'TIMEOUT' });
    pending.resolve(remote);
    await h.sandbox.pendingCreation;
    expect(h.sandbox.sandboxId).toBe(remote.id);
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('does not claim disposal when create remains unresolved', async () => {
    const h = setup({ readyTimeoutMs: 10, controlTimeoutMs: 10 });
    const pending = gate<typeof remote>();
    h.create.mockReturnValue(pending.promise);
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(h.sandbox.destroy()).rejects.toMatchObject({ code: 'CLEANUP' });
    expect(h.sandbox.status).toBe('error');
    pending.resolve(remote);
    await h.sandbox.pendingCreation;
    await h.sandbox.destroy();
    expect(h.sandbox.status).toBe('destroyed');
  });
  it('destroy during creation cleans up exactly once', async () => {
    const h = setup();
    const pending = gate<typeof remote>();
    h.create.mockReturnValue(pending.promise);
    const start = h.sandbox.start();
    const rejected = expect(start).rejects.toMatchObject({ code: 'ABORTED' });
    const destroyed = h.sandbox.destroy();
    pending.resolve(remote);
    await rejected;
    await destroyed;
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('attaches without create and never terminates on destroy or stop', async () => {
    const h = setup({ sandboxId: remote.id });
    await h.sandbox.start();
    await h.sandbox.stop();
    await h.sandbox.destroy();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.terminate).not.toHaveBeenCalled();
  });
  it('missing attachment never silently creates a replacement', async () => {
    const h = setup({ sandboxId: 'sbx-missing' });
    h.get.mockRejectedValue(new ClientError('missing', 404));
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.create).not.toHaveBeenCalled();
    expect(h.terminate).not.toHaveBeenCalled();
  });
  it.each([401, 403])('reports terminal authentication %i with the SDK cause', async status => {
    const h = setup();
    const cause = new ClientError('denied', status);
    h.create.mockRejectedValue(cause);
    await expect(h.sandbox.start()).rejects.toMatchObject({ code: 'AUTHENTICATION', cause });
    expect(h.create).toHaveBeenCalledTimes(1);
  });
  it('preserves cleanup failures and permits an explicit cleanup retry', async () => {
    const h = setup();
    await h.sandbox.start();
    h.terminate.mockRejectedValueOnce(new Error('network'));
    await expect(h.sandbox.destroy()).rejects.toMatchObject({
      code: 'CLEANUP',
      details: { sandboxId: remote.id },
    });
    expect(h.sandbox.status).toBe('error');
    await h.sandbox.destroy();
    expect(h.terminate).toHaveBeenCalledTimes(2);
  });
});

describe('commands', () => {
  it('preserves both streams, callbacks and nonzero final status without terminating', async () => {
    const h = setup();
    h.exec.mockResolvedValue(events(out('before'), { type: 'output', stream: 'stderr', data: 'bad' }, exit(7)));
    const onStdout = vi.fn(),
      onStderr = vi.fn();
    const result = await h.sandbox.executeCommand('false', [], { onStdout, onStderr });
    expect(result).toMatchObject({ stdout: 'before', stderr: 'bad', exitCode: 7, success: false });
    expect(onStdout).toHaveBeenCalledWith('before');
    expect(onStderr).toHaveBeenCalledWith('bad');
    expect(h.terminate).not.toHaveBeenCalled();
    await h.sandbox.destroy();
  });
  it('bounds UTF-8 retained output while callbacks receive all chunks', async () => {
    const h = setup({ maxOutputBytes: 5 });
    const callback = vi.fn();
    h.exec.mockResolvedValue(events(out('abc'), out('🙂def'), exit()));
    const result = await h.sandbox.executeCommand('echo', [], { onStdout: callback });
    expect(result).toMatchObject({ stdout: 'def', stdoutTruncated: true, stdoutDroppedBytes: 7 });
    expect(callback.mock.calls.map(x => x[0]).join('')).toBe('abc🙂def');
    await h.sandbox.destroy();
  });
  it('supports zero retention and rejects unbounded retention', async () => {
    const h = setup();
    h.exec.mockResolvedValue(events(out('text'), exit()));
    await expect(h.sandbox.executeCommand('echo', [], { maxRetainedBytes: 0 })).resolves.toMatchObject({
      stdout: '',
      stdoutDroppedBytes: 4,
    });
    await expect(h.sandbox.executeCommand('echo', [], { maxRetainedBytes: Infinity })).rejects.toMatchObject({
      code: 'CONFIGURATION',
    });
    await h.sandbox.destroy();
  });
  it('returns partial output and original stream error, with no retry', async () => {
    const h = setup();
    const failure = new Error('interrupted');
    h.exec.mockResolvedValue(
      (async function* () {
        yield out('partial');
        throw failure;
      })(),
    );
    await expect(h.sandbox.executeCommand('work')).rejects.toMatchObject({
      code: 'STREAM',
      cause: failure,
      details: { stdout: 'partial', remoteMayBeRunning: false },
    });
    expect(h.exec).toHaveBeenCalledTimes(1);
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('rejects a stream with no terminal event and cleans up', async () => {
    const h = setup();
    h.exec.mockResolvedValue(events(out('partial')));
    await expect(h.sandbox.executeCommand('work')).rejects.toMatchObject({ code: 'STREAM' });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('owned timeout terminates the sandbox without inventing an exit code', async () => {
    const h = setup();
    h.exec.mockImplementation(async (_id, _command, _owner, signal) =>
      (async function* () {
        yield out('began');
        await new Promise((_, reject) =>
          signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }),
        );
      })(),
    );
    await expect(h.sandbox.executeCommand('sleep 5', [], { timeout: 10 })).rejects.toMatchObject({
      code: 'TIMEOUT',
      details: { stdout: 'began', remoteMayBeRunning: false },
    });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('pre-aborted commands create no resource', async () => {
    const h = setup();
    const signal = AbortSignal.abort();
    await expect(h.sandbox.executeCommand('work', [], { abortSignal: signal })).rejects.toBeDefined();
    expect(h.create).not.toHaveBeenCalled();
  });
  it('owned in-flight cancellation terminates', async () => {
    const h = setup();
    const abort = new AbortController();
    h.exec.mockImplementation(async () => {
      abort.abort();
      return events(exit());
    });
    await expect(h.sandbox.executeCommand('work', [], { abortSignal: abort.signal })).rejects.toMatchObject({
      code: 'ABORTED',
    });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('attached cancellation never terminates and says remote work may continue', async () => {
    const h = setup({ sandboxId: remote.id });
    const abort = new AbortController();
    h.exec.mockImplementation(async () => {
      abort.abort();
      return events(exit());
    });
    await expect(h.sandbox.executeCommand('work', [], { abortSignal: abort.signal })).rejects.toMatchObject({
      code: 'ABORTED',
      details: { remoteMayBeRunning: true },
    });
    expect(h.terminate).not.toHaveBeenCalled();
  });
  it('rejects kill-timeout semantics for attached sandboxes before dispatch', async () => {
    const h = setup({ sandboxId: remote.id });
    await expect(h.sandbox.executeCommand('work', [], { timeout: 1 })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    expect(h.exec).not.toHaveBeenCalled();
  });
  it('allows overlapping operations without dispatching commands twice', async () => {
    const h = setup();
    const pending = gate<AsyncGenerator<Event>>();
    h.exec.mockReturnValueOnce(pending.promise);
    const first = h.sandbox.executeCommand('work');
    await vi.waitFor(() => expect(h.exec).toHaveBeenCalledTimes(1));
    expect((await h.sandbox.executeCommand('other')).success).toBe(true);
    await h.sandbox.writeFiles([]);
    pending.resolve(events(exit()));
    await first;
    expect(h.exec).toHaveBeenCalledTimes(2);
    await h.sandbox.destroy();
  });
  it('quotes literal argv, cwd, and env without injecting host credentials', async () => {
    const h = setup();
    const run = promisify(execFile);
    h.exec.mockImplementation(async (_id, command) => {
      const { stdout, stderr } = await run('/bin/bash', ['-c', command], { env: { PATH: process.env.PATH } });
      return events(out(stdout), { type: 'output', stream: 'stderr', data: stderr }, exit());
    });
    const value = "space ' quote $(echo injected) `echo injected` ;";
    const result = await h.sandbox.executeCommand('/usr/bin/printf', ['%s', value], {
      cwd: '/',
      env: { CHECK: value },
    });
    expect(result.stdout).toBe(value);
    expect(h.exec.mock.calls[0]![1]).not.toContain('test-token');
    await h.sandbox.destroy();
  });
  it('a failed cwd prevents command execution even with environment overrides', async () => {
    const h = setup();
    const run = promisify(execFile);
    let shellOutput = '';
    h.exec.mockImplementation(async (_id, command) => {
      try {
        await run('/bin/bash', ['-c', command]);
      } catch (e) {
        shellOutput = (e as { stdout: string }).stdout;
      }
      return events(exit(1));
    });
    await h.sandbox.executeCommand('echo MUST_NOT_RUN', [], {
      cwd: '/a-directory-that-does-not-exist-render-test',
      env: { CHECK: 'value' },
    });
    expect(shellOutput).toBe('');
    await h.sandbox.destroy();
  });
});

describe('files and configuration', () => {
  it('creates parents then uploads bytes and honors mode through chmod', async () => {
    const h = setup();
    await h.sandbox.writeFiles([{ path: "/workspace/a'b/file.bin", content: Buffer.from([0, 255]), mode: 0o600 }]);
    expect(h.exec.mock.calls[0]![1]).toContain('mkdir -p --');
    expect(h.upload).toHaveBeenCalledWith(remote.id, "/workspace/a'b/file.bin", Buffer.from([0, 255]), undefined, {
      signal: expect.any(AbortSignal),
    });
    expect(h.exec.mock.calls[1]![1]).toContain('chmod 600 --');
    await h.sandbox.destroy();
  });
  it('rejects oversized upload, invalid paths and modes before provisioning', async () => {
    const h = setup({ maxFileBytes: 2 });
    for (const file of [
      { path: '/x', content: 'long' },
      { path: 'relative', content: 'a' },
      { path: '/x', content: 'a', mode: 0 },
    ]) {
      await expect(h.sandbox.writeFiles([file])).rejects.toBeDefined();
    }
    expect(h.create).not.toHaveBeenCalled();
  });
  it('downloads small binary artifacts through the public SDK', async () => {
    const h = setup();
    h.exec.mockResolvedValue(events(out('2\n'), exit()));
    expect(await h.sandbox.readFile('/workspace/result')).toEqual(Buffer.from('hi'));
    expect(h.download).toHaveBeenCalledTimes(1);
    await h.sandbox.destroy();
  });
  it('refuses oversized downloads before transfer', async () => {
    const h = setup({ maxFileBytes: 2 });
    h.exec.mockResolvedValue(events(out('3\n'), exit()));
    await expect(h.sandbox.readFile('/x')).rejects.toMatchObject({ code: 'FILE_LIMIT' });
    expect(h.download).not.toHaveBeenCalled();
    await h.sandbox.destroy();
  });
  it('upload cancellation cleans owned sandbox', async () => {
    const h = setup();
    const abort = new AbortController();
    h.upload.mockImplementation(async () => {
      abort.abort();
      throw new Error('aborted transfer');
    });
    await expect(
      h.sandbox.writeFiles([{ path: '/x', content: 'hi' }], { abortSignal: abort.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(h.terminate).toHaveBeenCalledTimes(1);
  });
  it('attached upload failure never terminates', async () => {
    const h = setup({ sandboxId: remote.id });
    h.upload.mockRejectedValue(new Error('failed'));
    await expect(h.sandbox.writeFiles([{ path: '/x', content: 'hi' }])).rejects.toBeDefined();
    expect(h.terminate).not.toHaveBeenCalled();
  });
  it('keeps authentication configuration separate from explicit sandbox environment', async () => {
    const h = setup({
      create: { env: { APP_MODE: 'test' }, networkPolicy: { default: 'allow-all' }, timeoutSeconds: 300 },
    });
    await h.sandbox.start();
    expect(h.create.mock.calls[0]![0]).toEqual({
      env: { APP_MODE: 'test' },
      networkPolicy: { default: 'allow-all' },
      timeoutSeconds: 300,
    });
    await h.sandbox.destroy();
  });
  it('rejects mismatched owners, conflicting client configuration, and invalid bounds', () => {
    expect(() => new RenderSandbox({ ownerId: 'tea-a', create: { ownerId: 'tea-b' } })).toThrow();
    expect(() => new RenderSandbox({ client: new Render({ token: 'test' }), clientOptions: {} })).toThrow();
    expect(() => new RenderSandbox({ commandTimeoutMs: Infinity })).toThrow();
    expect(() => new RenderSandbox({ sandboxId: 'sbx-test', create: {} })).toThrow();
  });
  it('registers a public editor provider without storing credentials', () => {
    expect(renderSandboxProvider.id).toBe('render');
    expect(renderSandboxProvider.configSchema).not.toHaveProperty('properties.token');
    expect(renderSandboxProvider.createSandbox({ sandboxId: remote.id })).toBeInstanceOf(RenderSandbox);
  });
  it('advertises implemented checkpoints but no native background process manager', async () => {
    const h = setup();
    expect(h.sandbox.supportsCheckpoints).toBe(true);
    expect('processes' in h.sandbox).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });
  it('UTF-8 output tail is bounded across multiple fragments', () => {
    const tail = new OutputTail(4);
    tail.push('🙂');
    tail.push('x');
    expect(tail.toString()).toBe('x');
    expect(tail.dropped).toBe(4);
  });
});

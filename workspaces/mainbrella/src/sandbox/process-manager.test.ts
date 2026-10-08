import { describe, expect, it } from 'vitest';

import { API_KEY, FakeAPI } from '../../test/fake-api';
import { MainbrellaSandbox } from './index';

function setup() {
  const api = new FakeAPI();
  const sandbox = new MainbrellaSandbox({
    apiKey: API_KEY,
    apiUrl: 'http://localhost:8787',
    fetch: api.fetch,
    env: { BASE: 'one' },
  });
  return { api, sandbox };
}

describe('MainbrellaProcessManager', () => {
  it('streams UTF-8 output and executes arguments as literal argv with current env and cwd', async () => {
    const { api, sandbox } = setup();
    const chunks: string[] = [];
    sandbox.setEnv(env => ({ ...env, LIVE: 'yes' }));
    const result = await sandbox.executeCommand('printf', ['$(touch /tmp/unexpected)', 'a b'], {
      env: { BASE: 'override' },
      cwd: '/tmp',
      onStdout: chunk => chunks.push(chunk),
    });
    expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'hello 🦄\n', stderr: 'stderr\n' });
    expect(chunks.join('')).toBe(result.stdout);
    const request = api.requests.find(r => r.method === 'POST' && r.url.pathname === '/containers/executions');
    expect(request?.body).toEqual({
      argv: ['printf', '$(touch /tmp/unexpected)', 'a b'],
      timeoutMs: 30000,
      stdin: false,
      cwd: '/tmp',
      env: { BASE: 'override', LIVE: 'yes' },
    });
    expect(request?.url.searchParams.get('createdAt')).toBe(sandbox.container?.createdAt);
  });

  it('reconnects an interrupted stream from its cursor without replaying output or the command', async () => {
    const { api, sandbox } = setup();
    api.splitStream = true;
    const result = await sandbox.executeCommand('echo hello');
    expect(result.stdout).toBe('hello 🦄\n');
    const streams = api.requests.filter(r => r.url.pathname.endsWith('/events'));
    expect(streams.map(r => r.url.searchParams.get('cursor'))).toEqual(['0', '1']);
    expect(api.requests.filter(r => r.method === 'POST' && r.url.pathname === '/containers/executions')).toHaveLength(
      1,
    );
  });

  it.each([
    { status: 'timed_out' as const, timedOut: true, exitCode: null, expected: 124 },
    { status: 'output_limit' as const, outputTruncated: true, exitCode: null, expected: 1 },
    { status: 'interrupted' as const, exitCode: null, expected: 1 },
    { status: 'failed' as const, exitCode: 7, expected: 7 },
    { status: 'canceled' as const, exitCode: null, expected: 137 },
  ])('maps incomplete $status results to failure', async ({ expected, ...record }) => {
    const { api, sandbox } = setup();
    api.jobResult = record;
    const result = await sandbox.executeCommand('command');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(expected);
    if (record.outputTruncated) expect(result.stdoutTruncated).toBe(true);
  });

  it('never repeats an uncertain non-idempotent command admission', async () => {
    const { api, sandbox } = setup();
    api.failStart = true;
    await expect(sandbox.executeCommand('append')).rejects.toMatchObject({
      code: 'transport_unavailable',
      idempotencyKey: expect.any(String),
    });
    expect(api.requests.filter(r => r.url.pathname === '/containers/executions')).toHaveLength(1);
  });

  it('enforces timeout and stdin capability before admission', async () => {
    const { api, sandbox } = setup();
    api.capabilities.execution.stdin = false;
    await expect(sandbox.processes.spawn('sleep', { timeout: 900001 })).rejects.toThrow('timeout');
    await expect(sandbox.processes.spawn('cat')).rejects.toMatchObject({ code: 'stdin_unavailable' });
    expect(api.requests.filter(r => r.url.pathname === '/containers/executions')).toHaveLength(0);
  });

  it('sends and closes stdin once through the exact job identity', async () => {
    const { api, sandbox } = setup();
    const handle = await sandbox.processes.spawn('cat');
    await handle.sendStdin('hello\n');
    await handle.closeStdin();
    await handle.wait();
    const stdin = api.requests.filter(r => r.url.pathname.endsWith('/stdin'));
    expect(stdin.map(r => r.method)).toEqual(['POST', 'DELETE']);
    expect(stdin.every(r => r.url.pathname.includes(handle.pid))).toBe(true);
  });

  it('retains bounded output while callbacks receive full chunks', async () => {
    const { sandbox } = setup();
    const chunks: string[] = [];
    const handle = await sandbox.processes.spawn('command', {
      stdinMode: 'ignore',
      maxRetainedBytes: 5,
      onStdout: chunk => chunks.push(chunk),
    });
    const result = await handle.wait();
    expect(chunks.join('')).toBe('hello 🦄\n');
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(5);
    expect(result.stdoutTruncated).toBe(true);
    await expect(handle.sendStdin('x')).rejects.toThrow('without stdin');
  });

  it('lists retained jobs and attaches completed jobs without restarting them', async () => {
    const { api, sandbox } = setup();
    const handle = await sandbox.processes.spawn('command');
    await handle.wait();
    expect(await sandbox.processes.list()).toMatchObject([{ pid: handle.pid, running: false, exitCode: 0 }]);
    const attached = new MainbrellaSandbox({
      apiKey: API_KEY,
      apiUrl: 'http://localhost:8787',
      fetch: api.fetch,
      container: sandbox.container,
    });
    const other = await attached.processes.get(handle.pid);
    expect(other?.exitCode).toBe(0);
    expect((await other?.wait())?.stdout).toBe('hello 🦄\n');
    expect(api.jobs.size).toBe(1);
  });

  it('couples abort to cancellation and collects retained output when streaming is unavailable', async () => {
    const { api, sandbox } = setup();
    api.capabilities.execution.streaming = false;
    api.jobResult = { status: 'running', exitCode: null };
    const abort = new AbortController();
    const handle = await sandbox.processes.spawn('sleep 30', { stdinMode: 'ignore', abortSignal: abort.signal });
    abort.abort();
    const result = await handle.wait();
    expect(result).toMatchObject({ success: false, killed: true, exitCode: 137, stdout: 'hello 🦄\n' });
    expect(api.requests.filter(r => r.method === 'DELETE' && r.url.pathname.includes(handle.pid))).toHaveLength(1);
    expect(api.requests.some(r => r.url.pathname.endsWith('/events'))).toBe(false);
  });
});

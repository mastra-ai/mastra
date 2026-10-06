import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';
import { CloudflareSandbox } from './sandbox';
import { createFakeBridge } from './testing/fake-bridge';

const path = '/workspace';
const config = { type: 's3', bucket: 'WORKSPACE_FILES', region: 'auto', prefix: 'chat-one/' };
const filesystem = (value: unknown = config) =>
  ({ id: 'files', name: 'files', provider: 's3', getMountConfig: () => value }) as WorkspaceFilesystem;
const operations = {
  command: (sandbox: CloudflareSandbox) => sandbox.executeCommand('echo user-command'),
  write: (sandbox: CloudflareSandbox) => sandbox.writeFiles([{ path: 'note.txt', content: 'keep' }]),
  read: (sandbox: CloudflareSandbox) => sandbox.readFile('note.txt'),
  archive: (sandbox: CloudflareSandbox) => sandbox.persistWorkspace(),
  restore: (sandbox: CloudflareSandbox) => sandbox.hydrateWorkspace(new Uint8Array([1])),
};

describe('required durable storage', () => {
  it.each(Object.entries(operations))('blocks %s after failed wake reconnect and a later call', async (_, operate) => {
    const bridge = createFakeBridge({ apiToken: 'secret' });
    let denyMount = false;
    const sandbox = new CloudflareSandbox({
      baseUrl: 'https://bridge.example.com', apiToken: 'secret',
      fetch: async (input, init) => {
        if (String(input).endsWith('/mount') && denyMount) return Response.json({ error: 'AccessDenied' }, { status: 403 });
        return bridge.fetch(input, init);
      },
    });
    await sandbox._start();
    await sandbox.mount(filesystem(), path);
    bridge.sleep();
    denyMount = true;
    for (let attempt = 0; attempt < 2; attempt++) await expect(operate(sandbox)).rejects.toThrow('AccessDenied');
    expect(bridge.execs.every(exec => exec.argv.join(' ').includes('mountpoint'))).toBe(true);
    expect(bridge.files.size).toBe(0);
    expect(bridge.persists).toHaveLength(0);
    expect(bridge.hydrations).toHaveLength(0);
    expect(sandbox.mounts.get(path)?.state).toBe('error');
    denyMount = false;
    await sandbox.writeFiles([{ path: 'note.txt', content: 'restored' }]);
    expect(bridge.files.get('/workspace/note.txt')).toBe('restored');
    expect(sandbox.mounts.get(path)?.state).toBe('mounted');
  });

  it('blocks operations after an initial failed mount', async () => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: async (input, init) =>
      String(input).endsWith('/mount') ? Response.json({ error: 'mount denied' }, { status: 403 }) : bridge.fetch(input, init) });
    await sandbox._start();
    expect((await sandbox.mount(filesystem(), path)).success).toBe(false);
    await expect(sandbox.executeCommand('true')).rejects.toThrow('mount denied');
    expect(bridge.execs).toHaveLength(1);
  });

  it.each(['nonzero', 'error', 'empty-error', 'missing-exit', 'malformed-exit', 'invalid-json', 'transport', 'unknown-path'])('rejects a %s probe before any file operation', async failure => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: async (input, init) => {
      if (String(input).endsWith('/exec')) {
        if (failure === 'transport') throw new Error('transport failed');
        const frame = failure === 'nonzero' ? 'event: exit\ndata: {"exit_code":1}\n\n'
          : failure === 'error' ? 'event: error\ndata: {"error":"probe denied"}\n\n'
          : failure === 'empty-error' ? 'event: error\ndata: {"error":""}\n\nevent: exit\ndata: {"exit_code":0}\n\n'
          : failure === 'malformed-exit' ? 'event: exit\ndata: {}\n\n'
          : failure === 'invalid-json' ? 'event: exit\ndata: not-json\n\n'
          : failure === 'unknown-path' ? `event: stdout\ndata: ${Buffer.from('/other\n').toString('base64')}\n\nevent: exit\ndata: {"exit_code":0}\n\n` : '';
        return new Response(frame, { headers: { 'content-type': 'text/event-stream' } });
      }
      return bridge.fetch(input, init);
    } });
    await sandbox._start();
    await sandbox.mount(filesystem(), path);
    await expect(sandbox.writeFiles([{ path: 'note.txt', content: 'bad' }])).rejects.toThrow();
    expect(bridge.files.size).toBe(0);
    expect(bridge.mounts).toHaveLength(1);
  });

  it('blocks a concurrent operation while startup is mounting', async () => {
    const bridge = createFakeBridge();
    let mounting!: () => void;
    const enteredMount = new Promise<void>(resolve => { mounting = resolve; });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: async (input, init) => {
      if (String(input).endsWith('/mount')) { mounting(); await gate; }
      return bridge.fetch(input, init);
    } });
    sandbox.mounts.add({ [path]: filesystem() });
    const start = sandbox._start();
    await enteredMount;
    await sandbox._start();
    await expect(sandbox.writeFiles([{ path: 'note.txt', content: 'bad' }])).rejects.toThrow('not ready');
    expect(bridge.files.size).toBe(0);
    release();
    await start;
    await sandbox.writeFiles([{ path: 'note.txt', content: 'good' }]);
    expect(bridge.files.get('/workspace/note.txt')).toBe('good');
  });

  it('blocks a pending mount added after startup', async () => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: bridge.fetch });
    await sandbox._start();
    sandbox.mounts.add({ [path]: filesystem() });
    await expect(sandbox.executeCommand('true')).rejects.toThrow('not ready');
    expect(bridge.execs).toHaveLength(0);
  });

  it('blocks both waiting and new file calls when a required mount is added during a probe', async () => {
    const bridge = createFakeBridge();
    let probing!: () => void;
    const enteredProbe = new Promise<void>(resolve => { probing = resolve; });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: async (input, init) => {
      if (String(input).endsWith('/exec')) { probing(); await gate; }
      return bridge.fetch(input, init);
    } });
    await sandbox._start();
    await sandbox.mount(filesystem(), path);
    const waiting = sandbox.writeFiles([{ path: 'note.txt', content: 'bad' }]);
    const failed = expect(waiting).rejects.toThrow('not ready');
    await enteredProbe;
    sandbox.mounts.add({ '/workspace/other': filesystem() });
    await expect(sandbox.executeCommand('true')).rejects.toThrow('not ready');
    release();
    await failed;
    expect(bridge.files.size).toBe(0);
    expect(bridge.execs).toHaveLength(1);
  });

  it('shares a failed verification across concurrent callers', async () => {
    const bridge = createFakeBridge();
    let probes = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: async (input, init) => {
      if (String(input).endsWith('/exec')) {
        probes++;
        await gate;
        return new Response('event: exit\ndata: {"exit_code":1}\n\n');
      }
      return bridge.fetch(input, init);
    } });
    await sandbox._start();
    await sandbox.mount(filesystem(), path);
    const calls = Promise.allSettled(Object.values(operations).map(operate => operate(sandbox)));
    release();
    expect((await calls).every(result => result.status === 'rejected')).toBe(true);
    expect(probes).toBe(1);
    expect(bridge.files.size).toBe(0);
  });

  it('uses a private binding with region auto and keeps explicit endpoints and AWS regions', async () => {
    const bridge = createFakeBridge();
    const sandbox = new CloudflareSandbox({ baseUrl: 'https://bridge.example.com', fetch: bridge.fetch });
    await sandbox._start();
    expect((await sandbox.mount(filesystem(), path)).success).toBe(true);
    expect(bridge.mounts[0]).toEqual({ bucket: 'WORKSPACE_FILES', mountPath: path, options: { prefix: '/chat-one/' } });
    await sandbox.mount(filesystem({ ...config, region: 'us-east-1' }), '/workspace/aws');
    expect(bridge.mounts[1]).toMatchObject({ options: { endpoint: 'https://s3.us-east-1.amazonaws.com' } });
    await sandbox.mount(filesystem({ ...config, endpoint: 'https://example.com', accessKeyId: 'key', secretAccessKey: 'secret' }), '/workspace/s3');
    expect(bridge.mounts[2]).toMatchObject({ options: { endpoint: 'https://example.com', credentials: { accessKeyId: 'key', secretAccessKey: 'secret' } } });
    expect((await sandbox.mount(filesystem({ ...config, accessKeyId: 'key', secretAccessKey: 'secret' }), '/workspace/invalid')).success).toBe(false);
    expect((await sandbox.mount(filesystem({ ...config, accessKeyId: 'key' }), '/workspace/partial')).success).toBe(false);
    expect(bridge.mounts).toHaveLength(3);
  });
});

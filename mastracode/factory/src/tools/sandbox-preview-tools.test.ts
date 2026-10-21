import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSandboxPreviewTools } from './sandbox-preview-tools.js';
import type { FactoryToolScope } from './scope.js';

const peek = vi.hoisted(() => vi.fn());
vi.mock('../sandbox/session-sandbox.js', () => ({ peekSessionSandbox: peek }));

const scope: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'session-1',
  resourceId: 'session-1',
  threadId: 'thread-1',
  kind: 'user',
  interactive: true,
};

const processId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const instance = {
  sandboxId: 'sandbox-1',
  startPersistentProcess: vi.fn(async () => ({ id: processId, pid: 123 })),
  getPersistentProcess: vi.fn(async () => ({ id: processId, running: true })),
  stopPersistentProcess: vi.fn(async () => undefined),
  previewRequest: vi.fn(),
};

function setup(userId = 'user-1') {
  peek.mockReturnValue({ sandbox: instance });
  const sessions = {
    getBySessionId: vi.fn(async () => ({ id: 'session-1', orgId: 'org-1', userId, sandboxId: 'sandbox-1' })),
  };
  const tools = createSandboxPreviewTools(scope, { sessions } as never);
  const run = (name: string, input: unknown) => tools[name]!.execute(input, {});
  return { run, sessions };
}

describe('sandbox preview agent tools', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('starts, reads and stops a process in the owned session sandbox', async () => {
    const { run } = setup();
    expect(await run('factory_start_preview_process', { command: 'npm run dev', cwd: '/workspace' })).toEqual({
      id: processId,
      pid: 123,
    });
    expect(instance.startPersistentProcess).toHaveBeenCalledWith('npm run dev', '/workspace');
    expect(await run('factory_preview_process_status', { processId })).toEqual({ id: processId, running: true });
    expect(await run('factory_stop_preview_process', { processId })).toEqual({ stopped: true });
    expect(instance.stopPersistentProcess).toHaveBeenCalledWith(processId);
  });

  it('issues a signed preview link and rejects non-owner or stale sandbox', async () => {
    vi.stubEnv('MASTRACODE_PREVIEW_ORIGIN', 'https://preview.example.test');
    vi.stubEnv('MASTRACODE_PREVIEW_SIGNING_KEY', 'example-secret');
    const { run } = setup();
    const result = (await run('factory_preview_port', { port: 3000 })) as { url: string };
    expect(result.url).toMatch(/^https:\/\/preview\.example\.test\/web\/preview\/open\?ticket=/);
    const decoded = JSON.parse(
      Buffer.from(new URL(result.url).searchParams.get('ticket')!.split('.')[0]!, 'base64url').toString(),
    );
    expect(decoded).toMatchObject({ sessionId: 'session-1', userId: 'user-1', sandboxId: 'sandbox-1', port: 3000 });
    const other = setup('someone-else');
    await expect(other.run('factory_preview_port', { port: 3000 })).rejects.toThrow('unavailable');
    const owned = setup();
    instance.sandboxId = 'sandbox-2';
    await expect(owned.run('factory_start_preview_process', { command: 'npm run dev' })).rejects.toThrow('unavailable');
    instance.sandboxId = 'sandbox-1';
  });
});

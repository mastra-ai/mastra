import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VercelSandbox } from './index';

const createMock = vi.fn();
const getOrCreateMock = vi.fn();
const getMock = vi.fn();

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: (...args: unknown[]) => createMock(...args),
    getOrCreate: (...args: unknown[]) => getOrCreateMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

/** Build a fake @vercel/sandbox instance with the methods the provider uses. */
function makeFakeSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'fake-sandbox',
    stop: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    domain: vi.fn((port: number) => `https://port-${port}.vercel.run`),
    runCommand: vi.fn(),
    writeFiles: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Build a fake non-detached CommandFinished result. */
function makeFinished(exitCode: number, stdout: string, stderr = '') {
  return {
    exitCode,
    stdout: vi.fn().mockResolvedValue(stdout),
    stderr: vi.fn().mockResolvedValue(stderr),
  };
}

describe('VercelSandbox', () => {
  beforeEach(() => {
    createMock.mockReset();
    getOrCreateMock.mockReset();
    getMock.mockReset();
    getMock.mockRejectedValue(new Error('not_found'));
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_PROJECT_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates an instance with defaults', () => {
      const sandbox = new VercelSandbox();
      expect(sandbox.name).toBe('VercelSandbox');
      expect(sandbox.provider).toBe('vercel-sandbox');
      expect(sandbox.status).toBe('pending');
      expect(sandbox.id).toMatch(/^vercel-sandbox-/);
      expect(sandbox.processes).toBeDefined();
    });
  });

  describe('start()', () => {
    it('calls Sandbox.create with mapped options and uses OIDC by default', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({
        runtime: 'node22',
        timeout: 600_000,
        resources: { vcpus: 4 },
        ports: [3000],
        env: { FOO: 'bar' },
      });
      await sandbox._start();

      expect(sandbox.status).toBe('running');
      expect(createMock).toHaveBeenCalledTimes(1);
      const params = createMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.runtime).toBe('node22');
      expect(params.timeout).toBe(600_000);
      expect(params.resources).toEqual({ vcpus: 4 });
      expect(params.ports).toEqual([3000]);
      expect(params.env).toEqual({ FOO: 'bar' });
      // No explicit credentials → OIDC, so none of these are present.
      expect(params.token).toBeUndefined();
      expect(params.teamId).toBeUndefined();
      expect(params.projectId).toBeUndefined();
    });

    it('passes explicit credentials when all three are provided', async () => {
      createMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox({
        token: 't',
        teamId: 'team',
        projectId: 'proj',
      });
      await sandbox._start();

      const params = createMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.token).toBe('t');
      expect(params.teamId).toBe('team');
      expect(params.projectId).toBe('proj');
    });

    it('reads credentials from env vars', async () => {
      process.env.VERCEL_TOKEN = 'envtoken';
      process.env.VERCEL_TEAM_ID = 'envteam';
      process.env.VERCEL_PROJECT_ID = 'envproj';
      createMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox();
      await sandbox._start();

      const params = createMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.token).toBe('envtoken');
      expect(params.teamId).toBe('envteam');
      expect(params.projectId).toBe('envproj');
    });

    it('throws when credentials are incomplete', async () => {
      const sandbox = new VercelSandbox({ token: 'only-token' });
      const error = await sandbox._start().catch(e => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Incomplete credentials');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('ignores a stray teamId/projectId without a token and falls back to OIDC', async () => {
      process.env.VERCEL_TEAM_ID = 'stray-team';
      createMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox();
      await sandbox._start();

      const params = createMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.token).toBeUndefined();
      expect(params.teamId).toBeUndefined();
      expect(params.projectId).toBeUndefined();
    });

    it('does not recreate the sandbox if already running', async () => {
      createMock.mockResolvedValue(makeFakeSandbox());
      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._start();
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    it('uses Sandbox.getOrCreate when sandboxName is set (named identity/resume)', async () => {
      getOrCreateMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox({ sandboxName: 'my-app', runtime: 'node22', ports: [4111] });
      await sandbox._start();

      expect(createMock).not.toHaveBeenCalled();
      expect(getOrCreateMock).toHaveBeenCalledTimes(1);
      const params = getOrCreateMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.name).toBe('my-app');
      expect(params.runtime).toBe('node22');
      expect(params.ports).toEqual([4111]);
    });

    it('uses Sandbox.create when no sandboxName is set', async () => {
      createMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox();
      await sandbox._start();

      expect(getOrCreateMock).not.toHaveBeenCalled();
      expect(createMock).toHaveBeenCalledTimes(1);
      const params = createMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(params.name).toBeUndefined();
    });
  });

  describe('networking', () => {
    it('getPortUrl returns the public domain for an exposed port', async () => {
      createMock.mockResolvedValue(makeFakeSandbox());

      const sandbox = new VercelSandbox({ ports: [4111] });
      await sandbox._start();

      await expect(sandbox.networking.getPortUrl(4111)).resolves.toBe('https://port-4111.vercel.run');
    });

    it('getPortUrl returns null when the port has no route', async () => {
      createMock.mockResolvedValue(
        makeFakeSandbox({
          domain: vi.fn(() => {
            throw new Error('no route for port');
          }),
        }),
      );

      const sandbox = new VercelSandbox();
      await sandbox._start();

      await expect(sandbox.networking.getPortUrl(9999)).resolves.toBeNull();
    });

    it('getPortUrl returns null before the sandbox is started', async () => {
      const sandbox = new VercelSandbox({ ports: [4111] });
      await expect(sandbox.networking.getPortUrl(4111)).resolves.toBeNull();
    });
  });

  describe('writeFiles()', () => {
    it('forwards files to the SDK writeFiles', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox.writeFiles([
        { path: 'index.mjs', content: 'export {}' },
        { path: '/tmp/data.bin', content: Buffer.from([1, 2, 3]) },
      ]);

      expect(fake.writeFiles).toHaveBeenCalledTimes(1);
      const files = (fake.writeFiles as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(files).toEqual([
        { path: 'index.mjs', content: 'export {}' },
        { path: '/tmp/data.bin', content: Buffer.from([1, 2, 3]) },
      ]);
    });

    it('starts the sandbox if not already running', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox.writeFiles([{ path: 'a.txt', content: 'hi' }]);

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(fake.writeFiles).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeCommand()', () => {
    it('maps a successful result', async () => {
      const fake = makeFakeSandbox({
        runCommand: vi.fn().mockResolvedValue(makeFinished(0, 'hello\n')),
      });
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.command).toBe('echo hello');

      const runArgs = (fake.runCommand as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(runArgs.cmd).toBe('echo');
      expect(runArgs.args).toEqual(['hello']);
    });

    it('maps a failed result', async () => {
      const fake = makeFakeSandbox({
        runCommand: vi.fn().mockResolvedValue(makeFinished(1, '', 'boom')),
      });
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      const result = await sandbox.executeCommand('false');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('boom');
    });

    it('invokes streaming callbacks', async () => {
      const fake = makeFakeSandbox({
        runCommand: vi.fn().mockResolvedValue(makeFinished(0, 'out', 'err')),
      });
      createMock.mockResolvedValue(fake);

      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const sandbox = new VercelSandbox();
      await sandbox.executeCommand('cmd', [], { onStdout, onStderr });

      expect(onStdout).toHaveBeenCalledWith('out');
      expect(onStderr).toHaveBeenCalledWith('err');
    });

    it('returns a timeout result (exit code 124) when the command exceeds the timeout', async () => {
      const fake = makeFakeSandbox({
        // Never resolves within the timeout window.
        runCommand: vi.fn().mockReturnValue(new Promise(() => {})),
      });
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      const result = await sandbox.executeCommand('sleep', ['100'], { timeout: 20 });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
      expect(result.success).toBe(false);
    });

    it('passes cwd and merged env to runCommand', async () => {
      const fake = makeFakeSandbox({
        runCommand: vi.fn().mockResolvedValue(makeFinished(0, '')),
      });
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ env: { BASE: '1' } });
      await sandbox.executeCommand('node', ['app.js'], { cwd: '/app', env: { EXTRA: '2' } });

      const runArgs = (fake.runCommand as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(runArgs.cwd).toBe('/app');
      expect(runArgs.env).toEqual({ BASE: '1', EXTRA: '2' });
    });
  });

  describe('getInfo()', () => {
    it('includes runtime, timeout and exposed port domains', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ runtime: 'node24', timeout: 120_000, ports: [8080] });
      await sandbox._start();

      const info = sandbox.getInfo();
      expect(info.provider).toBe('vercel-sandbox');
      expect(info.metadata?.runtime).toBe('node24');
      expect(info.metadata?.timeout).toBe(120_000);
      expect(info.metadata?.domains).toEqual({ 8080: 'https://port-8080.vercel.run' });
    });
  });

  describe('getInstructions()', () => {
    it('returns default instructions describing the MicroVM', () => {
      const sandbox = new VercelSandbox();
      const text = sandbox.getInstructions!();
      expect(text).toContain('Vercel Sandbox');
      expect(text).toContain('Firecracker MicroVM');
      expect(text).toContain('node24');
    });

    it('honors a string override', () => {
      const sandbox = new VercelSandbox({ instructions: 'custom only' });
      expect(sandbox.getInstructions!()).toBe('custom only');
    });

    it('honors a function override receiving defaults', () => {
      const sandbox = new VercelSandbox({
        instructions: ({ defaultInstructions }) => `${defaultInstructions}\nEXTRA`,
      });
      const text = sandbox.getInstructions!();
      expect(text).toContain('Firecracker MicroVM');
      expect(text.endsWith('EXTRA')).toBe(true);
    });
  });

  describe('WorkspaceSandbox conformance', () => {
    it('exposes sandbox tools when wired into a Workspace', async () => {
      const sandbox = new VercelSandbox();
      const workspace = new Workspace({ sandbox });
      const tools = await createWorkspaceTools(workspace);

      expect(tools).toHaveProperty('mastra_workspace_execute_command');
      expect(tools).toHaveProperty('mastra_workspace_get_process_output');
      expect(tools).toHaveProperty('mastra_workspace_kill_process');
    });
  });

  describe('lifecycle stop/destroy', () => {
    it('stops the underlying sandbox and clears state', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._stop();

      expect(fake.stop).toHaveBeenCalledTimes(1);
      expect(sandbox.status).toBe('stopped');
    });

    it('destroy permanently deletes the sandbox', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._destroy();

      expect(fake.delete).toHaveBeenCalledTimes(1);
      expect(fake.stop).not.toHaveBeenCalled();
      expect(sandbox.status).toBe('destroyed');
    });

    it('stop propagates failure so callers do not assume the sandbox snapshotted', async () => {
      const fake = makeFakeSandbox();
      fake.stop.mockRejectedValueOnce(new Error('stop failed'));
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();

      await expect(sandbox._stop()).rejects.toThrow('stop failed');
    });

    it('destroy propagates failure so callers do not assume cleanup completed', async () => {
      const fake = makeFakeSandbox();
      fake.delete.mockRejectedValueOnce(new Error('delete failed'));
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();

      await expect(sandbox._destroy()).rejects.toThrow('delete failed');
    });
  });

  describe('resume-less attach (named lookup without start)', () => {
    // The deployer engine and getDeployment() handles call the raw lifecycle
    // methods (`sandbox.destroy?.()`), so these tests exercise those directly.
    it('destroy on a fresh named instance attaches via Sandbox.get({ resume: false }) and deletes', async () => {
      const fake = makeFakeSandbox();
      getMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ sandboxName: 'my-app' });
      await sandbox.destroy();

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock.mock.calls[0]![0]).toMatchObject({ name: 'my-app', resume: false });
      expect(fake.delete).toHaveBeenCalledTimes(1);
      expect(createMock).not.toHaveBeenCalled();
      expect(getOrCreateMock).not.toHaveBeenCalled();
    });

    it('stop on a fresh named instance attaches without resuming and stops', async () => {
      const fake = makeFakeSandbox();
      getMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ sandboxName: 'my-app' });
      await sandbox.stop();

      expect(getMock.mock.calls[0]![0]).toMatchObject({ name: 'my-app', resume: false });
      expect(fake.stop).toHaveBeenCalledTimes(1);
    });

    it('getPortUrl on a fresh named instance resolves the URL without resuming', async () => {
      const fake = makeFakeSandbox();
      getMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ sandboxName: 'my-app', ports: [4111] });
      const url = await sandbox.networking.getPortUrl(4111);

      expect(url).toBe('https://port-4111.vercel.run');
      expect(getMock.mock.calls[0]![0]).toMatchObject({ name: 'my-app', resume: false });
      expect(getOrCreateMock).not.toHaveBeenCalled();
    });

    it('start() after a resume-less attach still resumes via getOrCreate', async () => {
      const fake = makeFakeSandbox();
      getMock.mockResolvedValue(fake);
      getOrCreateMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox({ sandboxName: 'my-app' });
      await sandbox.networking.getPortUrl(4111); // attaches without resuming
      await sandbox._start();

      expect(getOrCreateMock).toHaveBeenCalledTimes(1);
      expect(getOrCreateMock.mock.calls[0]![0]).toMatchObject({ name: 'my-app' });
    });

    it('destroy on a fresh unnamed instance is a no-op and never looks anything up', async () => {
      const sandbox = new VercelSandbox();
      await sandbox.destroy();

      expect(getMock).not.toHaveBeenCalled();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('destroy when the named sandbox does not exist is a silent no-op', async () => {
      getMock.mockRejectedValue(new Error('not_found'));

      const sandbox = new VercelSandbox({ sandboxName: 'gone' });
      await expect(sandbox.destroy()).resolves.toBeUndefined();
    });
  });
});

describe('VercelSandbox.clone', () => {
  it('constructs an unstarted sibling without any I/O', () => {
    const template = new VercelSandbox({ token: 'vc-tok', teamId: 'team-1', projectId: 'proj-1' });

    const child = template.clone({ id: 'mc-project-1' });

    expect(child).toBeInstanceOf(VercelSandbox);
    expect(child).not.toBe(template);
    expect(child.id).toBe('mc-project-1');
    expect(child.status).toBe('pending');
  });

  it('inherits credentials and applies env override, dropping the template sandboxName', () => {
    const template = new VercelSandbox({
      token: 'vc-tok',
      teamId: 'team-1',
      projectId: 'proj-1',
      sandboxName: 'template-box',
      env: { BASE: '1' },
    });

    const child = template.clone({ env: { GITHUB_TOKEN: 'ghs_abc' } });

    expect(child['_constructorOptions']).toMatchObject({
      token: 'vc-tok',
      teamId: 'team-1',
      projectId: 'proj-1',
      env: { GITHUB_TOKEN: 'ghs_abc' },
    });
    expect(child['_constructorOptions'].sandboxName).toBeUndefined();
  });

  it('maps idleTimeoutMinutes to the Vercel timeout in milliseconds', () => {
    const template = new VercelSandbox({ token: 'vc-tok', teamId: 'team-1', projectId: 'proj-1', timeout: 120_000 });

    const child = template.clone({ idleTimeoutMinutes: 15 });

    expect(child['_constructorOptions']).toMatchObject({ timeout: 900_000 });
  });

  it('inherits template defaults when no overrides are passed', () => {
    const template = new VercelSandbox({ token: 'vc-tok', timeout: 120_000, env: { BASE: '1' } });

    const child = template.clone();

    expect(child.id).not.toBe(template.id);
    expect(child['_constructorOptions']).toMatchObject({ token: 'vc-tok', timeout: 120_000, env: { BASE: '1' } });
  });
});

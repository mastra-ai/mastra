import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VercelSandbox } from './index';

const createMock = vi.fn();

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: (...args: unknown[]) => createMock(...args),
  },
}));

/** Build a fake @vercel/sandbox instance with the methods the provider uses. */
function makeFakeSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'fake-sandbox',
    stop: vi.fn().mockResolvedValue({}),
    domain: vi.fn((port: number) => `https://port-${port}.vercel.run`),
    runCommand: vi.fn(),
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

    it('does not recreate the sandbox if already running', async () => {
      createMock.mockResolvedValue(makeFakeSandbox());
      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._start();
      expect(createMock).toHaveBeenCalledTimes(1);
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

    it('destroy stops the sandbox', async () => {
      const fake = makeFakeSandbox();
      createMock.mockResolvedValue(fake);

      const sandbox = new VercelSandbox();
      await sandbox._start();
      await sandbox._destroy();

      expect(fake.stop).toHaveBeenCalledTimes(1);
      expect(sandbox.status).toBe('destroyed');
    });
  });
});

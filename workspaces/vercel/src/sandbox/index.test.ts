import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExecutorSource } from '../executor';
import { VercelSandbox } from './index';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-secret-uuid' });

function createDeploymentResponse(id: string, url: string, readyState = 'BUILDING', projectId?: string) {
  return {
    ok: true,
    json: async () => ({ id, url, readyState, ...(projectId ? { projectId } : {}) }),
    text: async () => '',
  };
}

function createExecuteResponse(result: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => result,
    text: async () => JSON.stringify(result),
  };
}

/**
 * Start a sandbox with fake timers. The polling loop and retry backoff use
 * real setTimeout, so we need to flush timers while the promise is in-flight.
 */
async function startWithTimers(sb: VercelSandbox) {
  const promise = sb._start();
  await vi.runAllTimersAsync();
  return promise;
}

describe('VercelSandbox', () => {
  let sandbox: VercelSandbox;

  beforeEach(() => {
    vi.useFakeTimers();
    // mockReset clears both call history AND queued implementations.
    // vi.clearAllMocks only clears call history, leaking mockResolvedValueOnce
    // values into subsequent tests.
    mockFetch.mockReset();
    sandbox = new VercelSandbox({ token: 'test-token' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with defaults', () => {
      expect(sandbox.name).toBe('VercelSandbox');
      expect(sandbox.provider).toBe('vercel');
      expect(sandbox.status).toBe('pending');
      expect(sandbox.id).toMatch(/^vercel-sandbox-/);
    });
  });

  describe('start()', () => {
    it('should deploy and poll until READY', async () => {
      // First call: create deployment (POST) → BUILDING
      // Second call: poll status (GET) → BUILDING
      // Third call: poll status (GET) → READY
      // Fourth call: warm-up ping
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up

      await startWithTimers(sandbox);

      expect(sandbox.status).toBe('running');

      // Verify deployment creation call
      const firstCall = mockFetch.mock.calls[0]!;
      expect(firstCall[0]).toContain('/v13/deployments');
      expect(firstCall[1]?.method).toBe('POST');

      const body = JSON.parse(firstCall[1]?.body as string);
      expect(body.files).toHaveLength(2); // execute.js + vercel.json
      expect(body.files[0].file).toBe('api/execute.js');
      expect(body.files[1].file).toBe('vercel.json');

      // Should NOT have env, functions, or regions at the top level
      expect(body.env).toBeUndefined();
      expect(body.functions).toBeUndefined();
      expect(body.regions).toBeUndefined();
    });

    it('should include vercel.json with correct functions and regions', async () => {
      const customSandbox = new VercelSandbox({
        token: 'test-token',
        memory: 512,
        maxDuration: 30,
        regions: ['sfo1', 'iad1'],
      });

      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(customSandbox);

      const firstCall = mockFetch.mock.calls[0]!;
      const body = JSON.parse(firstCall[1]?.body as string);
      const vercelJson = JSON.parse(body.files[1].data);

      expect(vercelJson.functions['api/execute.js'].memory).toBe(512);
      expect(vercelJson.functions['api/execute.js'].maxDuration).toBe(30);
      expect(vercelJson.regions).toEqual(['sfo1', 'iad1']);
    });

    it('should throw if no token', async () => {
      const noTokenSandbox = new VercelSandbox({ token: '' });
      const promise = noTokenSandbox._start().catch(e => e);
      await vi.runAllTimersAsync();
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Missing Vercel API token');
    });

    it('should throw if deployment creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const promise = sandbox._start().catch(e => e);
      await vi.runAllTimersAsync();
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Failed to create deployment: 403');
    });

    it('should throw if deployment enters ERROR state', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'ERROR'));

      const promise = sandbox._start().catch(e => e);
      await vi.runAllTimersAsync();
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Deployment failed with state: ERROR');
    });

    it('should include teamId in request', async () => {
      const teamSandbox = new VercelSandbox({ token: 'test-token', teamId: 'team-abc' });

      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(teamSandbox);

      const firstCall = mockFetch.mock.calls[0]!;
      expect(firstCall[0]).toContain('teamId=team-abc');
    });

    it('should not deploy twice if already running', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);
      const callCount = mockFetch.mock.calls.length;

      await sandbox._start();
      expect(mockFetch.mock.calls.length).toBe(callCount); // No additional calls
    });

    it('should poll through multiple BUILDING states before READY', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up

      await startWithTimers(sandbox);

      expect(sandbox.status).toBe('running');
      // create + 3 polls + warm-up = 5 calls
      expect(mockFetch.mock.calls.length).toBe(5);
    });

    it('should use existing protection bypass token when projectId is present', async () => {
      mockFetch
        // create deployment (with projectId)
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING', 'prj-456'))
        // poll → READY
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY', 'prj-456'))
        // project fetch → existing protectionBypass token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ protectionBypass: { 'bypass-secret-123': { scope: 'automation-bypass' } } }),
        })
        // warm-up
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);

      // Verify project fetch was called
      const projectCall = mockFetch.mock.calls[2]!;
      expect(projectCall[0]).toContain('/v9/projects/prj-456');

      // Verify warm-up includes the bypass header and per-sandbox bearer secret
      const warmUpCall = mockFetch.mock.calls[3]!;
      expect(warmUpCall[1]?.headers?.Authorization).toBe('Bearer test-secret-uuid');
      expect(warmUpCall[1]?.headers?.['x-vercel-protection-bypass']).toBe('bypass-secret-123');
    });

    it('should create protection bypass token when none exists', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING', 'prj-456'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY', 'prj-456'))
        // project fetch → no existing bypass
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ protectionBypass: {} }),
        })
        // PATCH to create bypass token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ protectionBypass: { 'new-bypass-token': { scope: 'automation-bypass' } } }),
        })
        // warm-up
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);

      // Verify PATCH was called to create the bypass token
      const patchCall = mockFetch.mock.calls[3]!;
      expect(patchCall[0]).toContain('/v1/projects/prj-456/protection-bypass');
      expect(patchCall[1]?.method).toBe('PATCH');

      // Verify warm-up includes the newly created bypass header and per-sandbox bearer secret
      const warmUpCall = mockFetch.mock.calls[4]!;
      expect(warmUpCall[1]?.headers?.Authorization).toBe('Bearer test-secret-uuid');
      expect(warmUpCall[1]?.headers?.['x-vercel-protection-bypass']).toBe('new-bypass-token');
    });

    it('should include protection bypass header in executeCommand', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING', 'prj-456'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY', 'prj-456'))
        // project fetch → existing bypass
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ protectionBypass: { 'bypass-token-abc': { scope: 'automation-bypass' } } }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up

      await startWithTimers(sandbox);

      // Now execute a command
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: 'hello',
          stderr: '',
          executionTimeMs: 5,
          timedOut: false,
        }),
      );

      const result = await sandbox.executeCommand('echo', ['hello']);
      expect(result.success).toBe(true);

      // Verify the execute call includes the bypass header and per-sandbox bearer secret
      const executeCall = mockFetch.mock.calls[4]!;
      expect(executeCall[1]?.headers?.Authorization).toBe('Bearer test-secret-uuid');
      expect(executeCall[1]?.headers?.['x-vercel-protection-bypass']).toBe('bypass-token-abc');
    });

    it('should skip bypass fetch when projectId is absent', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up only

      await startWithTimers(sandbox);

      // create + poll + warm-up = 3 calls (no project fetch)
      expect(mockFetch.mock.calls.length).toBe(3);
    });
  });

  describe('executeCommand()', () => {
    it('should auto-start on the first command', async () => {
      // Use a fresh sandbox — don't rely on the shared beforeEach start
      const freshSandbox = new VercelSandbox({ token: 'test-token' });

      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // warm-up
        .mockResolvedValueOnce(
          createExecuteResponse({
            success: true,
            exitCode: 0,
            stdout: 'ok',
            stderr: '',
            executionTimeMs: 5,
            timedOut: false,
          }),
        );

      const promise = freshSandbox.executeCommand('echo', ['ok']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('ok');
      expect(freshSandbox.status).toBe('running');
    });

    beforeEach(async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);
    });

    it('should execute a command successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: 'hello\n',
          stderr: '',
          executionTimeMs: 50,
          timedOut: false,
        }),
      );

      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.command).toBe('echo hello');
    });

    it('should handle failed commands', async () => {
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: 'not found',
          executionTimeMs: 10,
          timedOut: false,
        }),
      );

      const result = await sandbox.executeCommand('nonexistent');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('not found');
    });

    it('should return timedOut on 504', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: async () => 'Gateway Timeout',
      });

      const result = await sandbox.executeCommand('sleep', ['999']);

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it.each([429, 502, 503])('should retry on %i', async status => {
      mockFetch.mockResolvedValueOnce({ ok: false, status, text: async () => 'retryable' }).mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
          executionTimeMs: 10,
          timedOut: false,
        }),
      );

      const promise = sandbox.executeCommand('echo', ['ok']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('ok');
    });

    it('should throw after exhausting all retry attempts on 502', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'Bad Gateway' })
        .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'Bad Gateway' })
        .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'Bad Gateway' });

      // Capture the promise before flushing timers to avoid unhandled rejection warnings
      const promise = sandbox.executeCommand('echo', ['hi']).catch(e => e);
      await vi.runAllTimersAsync();
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Execute failed: 502');
    });

    it('should throw if destroyed', async () => {
      const freshSandbox = new VercelSandbox({ token: 'test-token' });
      // Force status to 'destroyed' to bypass ensureRunning auto-start
      (freshSandbox as any).status = 'destroyed';
      await expect(freshSandbox.executeCommand('echo', ['hi'])).rejects.toThrow(/not ready/i);
    });

    it('should call onStdout/onStderr callbacks', async () => {
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: 'out',
          stderr: 'err',
          executionTimeMs: 5,
          timedOut: false,
        }),
      );

      const onStdout = vi.fn();
      const onStderr = vi.fn();

      await sandbox.executeCommand('cmd', [], { onStdout, onStderr });

      expect(onStdout).toHaveBeenCalledWith('out');
      expect(onStderr).toHaveBeenCalledWith('err');
    });

    it('should pass env and cwd options', async () => {
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executionTimeMs: 5,
          timedOut: false,
        }),
      );

      await sandbox.executeCommand('ls', [], {
        env: { FOO: 'bar' },
        cwd: '/tmp/work',
      });

      // Check the last fetch call body
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]!;
      const body = JSON.parse(lastCall[1]?.body as string);
      expect(body.env).toEqual({ FOO: 'bar' });
      expect(body.cwd).toBe('/tmp/work');
    });

    it('should shell-quote args with special characters in command string', async () => {
      mockFetch.mockResolvedValueOnce(
        createExecuteResponse({
          success: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executionTimeMs: 5,
          timedOut: false,
        }),
      );

      const result = await sandbox.executeCommand('echo', ['hello world', "it's"]);

      expect(result.command).toBe("echo 'hello world' 'it'\\''s'");
    });
  });

  describe('stop()', () => {
    it('should disconnect from deployment but preserve ID for cleanup', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);
      expect(sandbox.status).toBe('running');

      await sandbox._stop();
      expect(sandbox.status).toBe('stopped');

      // executeCommand should fail after stop
      await expect(sandbox.executeCommand('echo', ['hi'])).rejects.toThrow();
    });

    it('should allow destroy to clean up after stop', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);
      await sandbox._stop();

      // destroy() after stop() should still DELETE the deployment
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await sandbox._destroy();

      const deleteCalls = mockFetch.mock.calls.filter((call: [string, RequestInit?]) => call[1]?.method === 'DELETE');
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0]![0]).toContain('/v13/deployments/dep-123');
    });

    it('should clean up stale deployment on restart', async () => {
      // First start: create (POST) + poll (GET → READY) + warm-up
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-old', 'old-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-old', 'old-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up

      await startWithTimers(sandbox);

      // Stop (preserves _deploymentId for cleanup)
      await sandbox._stop();

      // Second start should DELETE the old deployment before creating a new one
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE old
        .mockResolvedValueOnce(createDeploymentResponse('dep-new', 'new-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-new', 'new-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // warm-up

      await startWithTimers(sandbox);

      const deleteCalls = mockFetch.mock.calls.filter((call: [string, RequestInit?]) => call[1]?.method === 'DELETE');
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0]![0]).toContain('/v13/deployments/dep-old');
    });
  });

  describe('destroy()', () => {
    it('should delete the deployment', async () => {
      mockFetch
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'BUILDING'))
        .mockResolvedValueOnce(createDeploymentResponse('dep-123', 'my-deploy.vercel.app', 'READY'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await startWithTimers(sandbox);

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await sandbox._destroy();
      expect(sandbox.status).toBe('destroyed');

      // Verify DELETE was called
      const deleteCalls = mockFetch.mock.calls.filter((call: [string, RequestInit?]) => call[1]?.method === 'DELETE');
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0]![0]).toContain('/v13/deployments/dep-123');
    });

    it('should be a no-op when never started', async () => {
      const freshSandbox = new VercelSandbox({ token: 'test-token' });

      await freshSandbox._destroy();

      // No DELETE calls should have been made
      const deleteCalls = mockFetch.mock.calls.filter((call: [string, RequestInit?]) => call[1]?.method === 'DELETE');
      expect(deleteCalls.length).toBe(0);
    });
  });

  describe('getInstructions()', () => {
    it('should return default instructions', () => {
      const instructions = sandbox.getInstructions!();
      expect(instructions).toContain('Vercel serverless sandbox');
      expect(instructions).toContain('Stateless');
      expect(instructions).toContain('/tmp');
    });

    it('should use string override', () => {
      const customSandbox = new VercelSandbox({
        token: 'test-token',
        instructions: 'Custom instructions',
      });
      expect(customSandbox.getInstructions!()).toBe('Custom instructions');
    });

    it('should use function override', () => {
      const customSandbox = new VercelSandbox({
        token: 'test-token',
        instructions: ({ defaultInstructions }) => `${defaultInstructions}\nExtra info.`,
      });
      const result = customSandbox.getInstructions!();
      expect(result).toContain('Vercel serverless sandbox');
      expect(result).toContain('Extra info.');
    });
  });

  describe('getInfo()', () => {
    it('should return sandbox info', async () => {
      const info = await sandbox.getInfo!();
      expect(info.id).toBe(sandbox.id);
      expect(info.name).toBe('VercelSandbox');
      expect(info.provider).toBe('vercel');
      expect(info.metadata?.regions).toEqual(['iad1']);
    });
  });

  describe('getExecutorSource()', () => {
    it('should embed the secret in the source', () => {
      const source = getExecutorSource('my-secret-123', {});
      expect(source).toContain('"my-secret-123"');
      expect(source).toContain('SANDBOX_SECRET');
    });

    it('should embed env vars in the source', () => {
      const source = getExecutorSource('secret', { FOO: 'bar', BAZ: 'qux' });
      expect(source).toContain('"FOO"');
      expect(source).toContain('"bar"');
      expect(source).toContain('"BAZ"');
      expect(source).toContain('"qux"');
    });

    it('should use execFileSync (not execSync)', () => {
      const source = getExecutorSource('secret', {});
      expect(source).toContain('execFileSync');
      expect(source).not.toContain('execSync');
    });

    it('should use /bin/sh -c for commands without args', () => {
      const source = getExecutorSource('secret', {});
      expect(source).toContain('/bin/sh');
      expect(source).toContain('-c');
    });
  });
});

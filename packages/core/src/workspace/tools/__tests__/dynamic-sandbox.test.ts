import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RequestContext } from '../../../request-context';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { LocalSandbox } from '../../sandbox';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('dynamic sandbox tools', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-dynsb-tools-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  // A sandbox that runs commands but exposes no process manager.
  const makeCommandOnlySandbox = () => ({
    id: 'minimal-sandbox',
    name: 'MinimalSandbox',
    provider: 'minimal',
    status: 'running' as const,
    executeCommand: async () => ({
      command: 'echo ok',
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      success: true,
      executionTimeMs: 1,
    }),
  });

  it('should register sandbox tools when workspace has a sandbox resolver', async () => {
    const resolver = () => new LocalSandbox({ workingDirectory: tempDir });
    const workspace = new Workspace({ sandbox: resolver });

    const tools = await createWorkspaceTools(workspace);

    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
  });

  it('should resolve sandbox from requestContext during tool execution', async () => {
    const resolver = () => new LocalSandbox({ workingDirectory: tempDir });
    const workspace = new Workspace({ sandbox: resolver });
    const tools = await createWorkspaceTools(workspace);

    const beforeToolCall = new Date(Date.now() - 1000);
    workspace.lastAccessedAt = beforeToolCall;

    const ctx = { requestContext: new RequestContext() };
    const result = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute({ command: 'echo hello' }, ctx);

    expect(String(result)).toContain('hello');
    expect(workspace.lastAccessedAt.getTime()).toBeGreaterThan(beforeToolCall.getTime());
  });

  it('should resolve different sandboxes per request', async () => {
    const dirA = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-sb-a-'));
    const dirB = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-sb-b-'));
    try {
      const resolver = ({ requestContext }: { requestContext: RequestContext }) => {
        const role = requestContext.get('role') as string;
        return role === 'admin'
          ? new LocalSandbox({ workingDirectory: dirA })
          : new LocalSandbox({ workingDirectory: dirB });
      };
      const workspace = new Workspace({ sandbox: resolver });
      const tools = await createWorkspaceTools(workspace);

      const adminResult = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        { command: 'pwd' },
        { requestContext: new RequestContext([['role', 'admin']]) },
      );
      const userResult = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        { command: 'pwd' },
        { requestContext: new RequestContext([['role', 'user']]) },
      );

      // macOS resolves /tmp through /private, so compare against the canonical path
      const realDirA = await fs.realpath(dirA);
      const realDirB = await fs.realpath(dirB);
      expect(String(adminResult).trim()).toBe(realDirA);
      expect(String(userResult).trim()).toBe(realDirB);
    } finally {
      await fs.rm(dirA, { recursive: true, force: true });
      await fs.rm(dirB, { recursive: true, force: true });
    }
  });

  it('should resolve the configured sandbox even when requestContext is omitted', async () => {
    const workspace = new Workspace({
      sandbox: () => new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute({ command: 'echo ok' });

    expect(String(result)).toContain('ok');
  });

  it('should pass the requestContext through to the resolver per execution', async () => {
    const seenRoles: string[] = [];
    const resolver = ({ requestContext }: { requestContext: RequestContext }) => {
      seenRoles.push(requestContext.get('role') as string);
      return new LocalSandbox({ workingDirectory: tempDir });
    };
    const workspace = new Workspace({ sandbox: resolver });
    const tools = await createWorkspaceTools(workspace);

    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo a' },
      { requestContext: new RequestContext([['role', 'admin']]) },
    );
    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo b' },
      { requestContext: new RequestContext([['role', 'user']]) },
    );

    expect(seenRoles).toContain('admin');
    expect(seenRoles).toContain('user');
    expect(seenRoles.every(r => r === 'admin' || r === 'user')).toBe(true);
  });

  it('should support background process tools when the resolver returns the same sandbox for a request scope', async () => {
    const sandboxes = new Map<string, LocalSandbox>();
    const workspace = new Workspace({
      sandbox: ({ requestContext }) => {
        const userId = (requestContext.get('user-id') as string) ?? 'default';
        let sandbox = sandboxes.get(userId);
        if (!sandbox) {
          sandbox = new LocalSandbox({ workingDirectory: tempDir });
          sandboxes.set(userId, sandbox);
        }
        return sandbox;
      },
    });
    const tools = await createWorkspaceTools(workspace);
    const requestContext = new RequestContext([['user-id', 'alice']]);

    const started = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo done', background: true },
      { requestContext },
    );
    const pid = String(started).match(/PID: ([^)]+)/)?.[1];

    expect(pid).toBeDefined();

    const output = await tools[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT].execute(
      { pid: pid!, wait: true },
      { requestContext },
    );

    expect(String(output)).toContain('done');
  });

  it('should point to sandboxCacheKey when a fresh RequestContext cannot find a background process', async () => {
    const workspace = new Workspace({
      sandbox: () => new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const started = await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo done', background: true },
      { requestContext: new RequestContext() },
    );
    const pid = String(started).match(/PID: ([^)]+)/)?.[1];

    expect(pid).toBeDefined();

    const output = await tools[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT].execute(
      { pid: pid!, wait: true },
      { requestContext: new RequestContext() },
    );

    expect(String(output)).toContain(`No background process found with PID ${pid}`);
    expect(String(output)).toContain('sandboxCacheKey');
  });

  it('should throw a clear error when the resolved sandbox lacks process support', async () => {
    const sandbox = makeCommandOnlySandbox();
    const workspace = new Workspace({ sandbox: () => sandbox });
    const tools = await createWorkspaceTools(workspace);

    await expect(
      tools[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT].execute(
        { pid: 'missing' },
        { requestContext: new RequestContext() },
      ),
    ).rejects.toThrow('Sandbox does not support processes');
  });

  it('should throw a clear error when background execution is requested without process support', async () => {
    const sandbox = makeCommandOnlySandbox();
    const workspace = new Workspace({ sandbox: () => sandbox });
    const tools = await createWorkspaceTools(workspace);

    await expect(
      tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        { command: 'sleep 1', background: true },
        { requestContext: new RequestContext() },
      ),
    ).rejects.toThrow('Sandbox does not support processes');
  });

  it('should throw a clear error when the resolved sandbox lacks command execution support', async () => {
    const sandbox = {
      id: 'process-only-sandbox',
      name: 'ProcessOnlySandbox',
      provider: 'process-only',
      status: 'running' as const,
      processes: {
        spawn: async () => {
          throw new Error('not used');
        },
      },
    };
    const workspace = new Workspace({ sandbox: () => sandbox as any });
    const tools = await createWorkspaceTools(workspace);

    await expect(
      tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
        { command: 'echo ok' },
        { requestContext: new RequestContext() },
      ),
    ).rejects.toThrow('Sandbox does not support executeCommand');
  });

  it('should not invoke the sandbox resolver when only filesystem tools execute', async () => {
    let resolverCalls = 0;
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      sandbox: () => {
        resolverCalls++;
        return new LocalSandbox({ workingDirectory: tempDir });
      },
    });
    const tools = await createWorkspaceTools(workspace);

    await fs.writeFile(path.join(tempDir, 'f.txt'), 'hi');

    await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'f.txt', showLineNumbers: false },
      { requestContext: new RequestContext() },
    );

    expect(resolverCalls).toBe(0);
  });

  it('should not invoke the filesystem resolver when only sandbox tools execute', async () => {
    let filesystemResolverCalls = 0;
    const workspace = new Workspace({
      filesystem: () => {
        filesystemResolverCalls++;
        return new LocalFilesystem({ basePath: tempDir });
      },
      sandbox: () => new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo sandbox-only' },
      { requestContext: new RequestContext() },
    );

    expect(filesystemResolverCalls).toBe(0);
  });

  it('should call the resolver exactly once per request across instructions and tool calls', async () => {
    // With dynamicSandbox: 'resolve', building instructions resolves the sandbox
    // too — the per-request cache must share that one resolver call with the tools.
    let resolverCalls = 0;
    const workspace = new Workspace({
      sandbox: () => {
        resolverCalls++;
        return new LocalSandbox({ workingDirectory: tempDir });
      },
      instructions: { dynamicSandbox: 'resolve' },
    });
    const tools = await createWorkspaceTools(workspace);
    const requestContext = new RequestContext([['user-id', 'alice']]);

    await workspace.getInstructionsAsync({ requestContext });
    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute({ command: 'echo a' }, { requestContext });
    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute({ command: 'echo b' }, { requestContext });

    expect(resolverCalls).toBe(1);
  });

  it('should resolve a fresh sandbox for each new requestContext', async () => {
    let resolverCalls = 0;
    const workspace = new Workspace({
      sandbox: () => {
        resolverCalls++;
        return new LocalSandbox({ workingDirectory: tempDir });
      },
    });
    const tools = await createWorkspaceTools(workspace);

    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo a' },
      { requestContext: new RequestContext() },
    );
    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo b' },
      { requestContext: new RequestContext() },
    );

    expect(resolverCalls).toBe(2);
  });

  it('should emit the resolved sandbox provider in workspace metadata', async () => {
    // Metadata emission must not invoke the resolver again, but should still
    // report the sandbox the tool actually resolved for this request — not the
    // `dynamic` placeholder.
    const custom = vi.fn(async () => {});
    const workspace = new Workspace({
      sandbox: () => new LocalSandbox({ workingDirectory: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    await tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND].execute(
      { command: 'echo hi' },
      { requestContext: new RequestContext(), writer: { custom } },
    );

    const metadataCall = custom.mock.calls.find(call => (call[0] as any)?.type === 'data-workspace-metadata');
    expect(metadataCall?.[0]).toMatchObject({
      type: 'data-workspace-metadata',
      data: { sandbox: { provider: 'local' } },
    });
  });
});

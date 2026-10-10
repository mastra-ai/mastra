import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { describe, expect, it, vi } from 'vitest';
import { RenderSandbox } from './sandbox.js';

async function commandTool(attached = false) {
  const client = new Render({ token: 'test-token', ownerId: 'tea-test' });
  const api = client.experimental.sandboxes;
  const remote = { id: 'sbx-test', status: 'running' } as Awaited<ReturnType<typeof api.get>>;
  vi.spyOn(api, 'create').mockResolvedValue(remote);
  vi.spyOn(api, 'get').mockResolvedValue(remote);
  const terminate = vi.spyOn(api, 'terminate').mockResolvedValue();
  const exec = vi.spyOn(api, 'exec');
  const sandbox = new RenderSandbox({
    client,
    cancellationMode: 'terminate',
    ...(attached ? { sandboxId: remote.id } : {}),
  });
  const workspace = new Workspace({ sandbox });
  await workspace.init();
  const tools = await createWorkspaceTools(workspace);
  return { workspace, terminate, exec, tool: tools.mastra_workspace_execute_command };
}

describe('public Workspace command tool', () => {
  it('delivers both streams and a real nonzero exit through the generated tool', async () => {
    const h = await commandTool();
    h.exec.mockResolvedValue(
      (async function* () {
        yield { type: 'output', stream: 'stdout', data: 'before' } as const;
        yield { type: 'output', stream: 'stderr', data: 'bad' } as const;
        yield { type: 'exit', exit_code: 7 } as const;
      })(),
    );
    const output = await h.tool.execute({ command: 'false' });
    expect(output).toContain('before');
    expect(output).toContain('bad');
    expect(output).toContain('Exit code: 7');
    expect(h.terminate).not.toHaveBeenCalled();
    await h.workspace.destroy();
  });

  it.each([false, true])('aborts with ownership respected (attached=%s)', async attached => {
    const h = await commandTool(attached);
    const abort = new AbortController();
    h.exec.mockResolvedValue(
      (async function* () {
        abort.abort();
        yield { type: 'output', stream: 'stdout', data: 'started' } as const;
      })(),
    );
    const output = await h.tool.execute({ command: 'sleep 60' }, { abortSignal: abort.signal });
    expect(output).toContain('Error: Render sandbox aborted failure');
    expect(h.terminate).toHaveBeenCalledTimes(attached ? 0 : 1);
    if (attached) expect(output).toContain('Remote work may still be running');
    await h.workspace.destroy();
  });

  it('keeps a failed termination visible in the tool error', async () => {
    const h = await commandTool();
    const abort = new AbortController();
    h.terminate.mockRejectedValueOnce(new Error('connection lost'));
    h.exec.mockResolvedValue(
      (async function* () {
        abort.abort();
        yield { type: 'output', stream: 'stdout', data: 'started' } as const;
      })(),
    );
    const output = await h.tool.execute({ command: 'sleep 60' }, { abortSignal: abort.signal });
    expect(output).toContain('Remote work may still be running');
    await h.workspace.destroy();
    expect(h.terminate).toHaveBeenCalledTimes(2);
  });
});

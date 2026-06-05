import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveWorkspaceId } from '../handler';

function makeAgent(object?: { id: string }) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveWorkspaceId', () => {
  it('returns the explicit id when provided, without calling the agent', async () => {
    const { agent, generate } = makeAgent();
    await expect(resolveWorkspaceId(agent, 'ws_123')).resolves.toBe('ws_123');
    expect(generate).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace on an explicit id', async () => {
    const { agent, generate } = makeAgent();
    await expect(resolveWorkspaceId(agent, '  ws_123  ')).resolves.toBe('ws_123');
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns undefined when no id and no available workspaces', async () => {
    const { agent, generate } = makeAgent();
    await expect(resolveWorkspaceId(agent, undefined)).resolves.toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns undefined when the available list is empty', async () => {
    const { agent, generate } = makeAgent();
    await expect(resolveWorkspaceId(agent, undefined, [])).resolves.toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });

  it('lets the agent select one workspace from the available list', async () => {
    const { agent, generate } = makeAgent({ id: 'ws_b' });
    const available = [
      { id: 'ws_a', name: 'A' },
      { id: 'ws_b', name: 'B' },
    ];
    await expect(resolveWorkspaceId(agent, undefined, available)).resolves.toBe('ws_b');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when the agent selects an id not in the list', async () => {
    const { agent } = makeAgent({ id: 'ws_unknown' });
    const available = [{ id: 'ws_a', name: 'A' }];
    await expect(resolveWorkspaceId(agent, undefined, available)).resolves.toBeUndefined();
  });

  it('returns undefined when the agent selects nothing (empty string)', async () => {
    const { agent } = makeAgent({ id: '' });
    const available = [{ id: 'ws_a', name: 'A' }];
    await expect(resolveWorkspaceId(agent, undefined, available)).resolves.toBeUndefined();
  });

  it('passes the structured-output schema when invoking the agent', async () => {
    const { agent, generate } = makeAgent({ id: 'ws_a' });
    const available = [{ id: 'ws_a', name: 'A' }];
    await resolveWorkspaceId(agent, undefined, available);
    expect(generate).toHaveBeenCalledWith(expect.any(String), {
      structuredOutput: { schema: expect.anything() },
    });
  });
});

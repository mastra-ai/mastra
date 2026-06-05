import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveWorkspaceId } from '../handler';

function makeAgent() {
  const generate = vi.fn();
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveWorkspaceId', () => {
  it('returns the id when provided, without calling the agent', async () => {
    const { agent, generate } = makeAgent();
    await expect(resolveWorkspaceId(agent, 'ws_123')).resolves.toBe('ws_123');
    expect(generate).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace', async () => {
    const { agent } = makeAgent();
    await expect(resolveWorkspaceId(agent, '  ws_123  ')).resolves.toBe('ws_123');
  });

  it('returns undefined for undefined input', async () => {
    const { agent } = makeAgent();
    await expect(resolveWorkspaceId(agent, undefined)).resolves.toBeUndefined();
  });

  it('returns undefined for an empty string', async () => {
    const { agent } = makeAgent();
    await expect(resolveWorkspaceId(agent, '')).resolves.toBeUndefined();
  });

  it('returns undefined for whitespace-only input', async () => {
    const { agent } = makeAgent();
    await expect(resolveWorkspaceId(agent, '   ')).resolves.toBeUndefined();
  });
});

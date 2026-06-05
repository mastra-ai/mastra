import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveBrowserEnabled } from './browser';

function makeAgent(browserEnabled: boolean) {
  const generate = vi.fn().mockResolvedValue({ object: { browserEnabled } });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveBrowserEnabled', () => {
  it('returns the explicit true without calling the agent', async () => {
    const { agent, generate } = makeAgent(false);
    await expect(resolveBrowserEnabled(agent, 'a web research agent', true)).resolves.toBe(true);
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns the explicit false without calling the agent', async () => {
    const { agent, generate } = makeAgent(true);
    await expect(resolveBrowserEnabled(agent, 'a web research agent', false)).resolves.toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it('asks the agent to decide when not explicitly set', async () => {
    const { agent, generate } = makeAgent(true);
    await expect(resolveBrowserEnabled(agent, 'a web research agent')).resolves.toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('returns the agent decision when it declines browser access', async () => {
    const { agent } = makeAgent(false);
    await expect(resolveBrowserEnabled(agent, 'a math tutor', undefined)).resolves.toBe(false);
  });
});

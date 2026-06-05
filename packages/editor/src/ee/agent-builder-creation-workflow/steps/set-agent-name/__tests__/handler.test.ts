import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { resolveName } from '../handler';

function makeAgent(object: { name: string }) {
  const generate = vi.fn().mockResolvedValue({ object });
  return { agent: { generate } as unknown as Agent, generate };
}

describe('resolveName', () => {
  it('uses the explicit name without calling the agent', async () => {
    const { agent, generate } = makeAgent({ name: 'Should Not Use' });
    await expect(resolveName(agent, 'a chatty support bot', 'Support Hero')).resolves.toBe('Support Hero');
    expect(generate).not.toHaveBeenCalled();
  });

  it('trims the explicit name and skips the agent', async () => {
    const { agent, generate } = makeAgent({ name: 'Should Not Use' });
    await expect(resolveName(agent, 'anything', '  Trimmed Name  ')).resolves.toBe('Trimmed Name');
    expect(generate).not.toHaveBeenCalled();
  });

  it('asks the agent when no explicit name is given', async () => {
    const { agent, generate } = makeAgent({ name: 'Research Assistant' });
    await expect(resolveName(agent, 'research assistant agent')).resolves.toBe('Research Assistant');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('asks the agent when the explicit name is empty/whitespace', async () => {
    const { agent, generate } = makeAgent({ name: 'Derived Name' });
    await expect(resolveName(agent, 'some agent', '   ')).resolves.toBe('Derived Name');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('trims the agent-produced name', async () => {
    const { agent } = makeAgent({ name: '  Spaced Name  ' });
    await expect(resolveName(agent, 'an agent')).resolves.toBe('Spaced Name');
  });

  it('passes a structured-output schema to the agent', async () => {
    const { agent, generate } = makeAgent({ name: 'X' });
    await resolveName(agent, 'an agent');
    expect(generate.mock.calls[0]?.[1]).toMatchObject({ structuredOutput: { schema: expect.anything() } });
  });
});

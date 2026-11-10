import { ToolLoopAgent } from '@internal/ai-v6';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { MastraError } from '../error';
import { Mastra } from './index';

function makeAgent(id: string) {
  return new Agent({ id, name: id, instructions: 'Respond', model: 'openai/gpt-4o' });
}

describe.each([
  ['ordinary', (agent: Agent) => agent],
  ['durable', (agent: Agent) => createDurableAgent({ agent })],
] as const)('Mastra.addAgent with %s agents', (_kind, wrap) => {
  // A conflicting registration must be reported before the new agent is wired. (#29963)
  it('rejects a conflicting key without registering or initializing the second agent', () => {
    const mastra = new Mastra({ logger: false });
    const first = makeAgent('first');
    const second = makeAgent('second');
    const firstEntry = wrap(first);
    const secondEntry = wrap(second);

    mastra.addAgent(firstEntry, 'shared');
    expect(first.getMastraInstance()).toBe(mastra);

    expect(() => mastra.addAgent(secondEntry, 'shared')).toThrow(MastraError);
    expect(() => mastra.addAgent(secondEntry, 'shared')).toThrow('Agent with key shared already exists');
    expect(mastra.getAgent('shared')).toBe(firstEntry);
    expect(second.getMastraInstance()).toBeUndefined();
  });

  it('allows re-registering the same instance under its existing key', () => {
    const mastra = new Mastra({ logger: false });
    const agent = wrap(makeAgent('first'));
    mastra.addAgent(agent, 'shared');

    expect(() => mastra.addAgent(agent, 'shared')).not.toThrow();
    expect(mastra.getAgent('shared')).toBe(agent);
  });
});

describe('Mastra.addAgent with ToolLoopAgent inputs', () => {
  it('keeps re-registration of the same input idempotent and rejects a different input', () => {
    const mastra = new Mastra({ logger: false });
    const first = new ToolLoopAgent({ model: 'openai/gpt-4o', instructions: 'First' });
    const second = new ToolLoopAgent({ model: 'openai/gpt-4o', instructions: 'Second' });

    mastra.addAgent(first, 'shared');
    const registered = mastra.getAgent('shared');

    expect(() => mastra.addAgent(first, 'shared')).not.toThrow();
    expect(mastra.getAgent('shared')).toBe(registered);
    expect(() => mastra.addAgent(second, 'shared')).toThrow('Agent with key shared already exists');
    expect(mastra.getAgent('shared')).toBe(registered);
  });
});

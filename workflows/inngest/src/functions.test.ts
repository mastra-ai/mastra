import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';

import { createInngestAgent } from './durable-agent';
import { collectInngestFunctions } from './functions';

function makeInngestAgent(inngest: Inngest, id: string) {
  const agent = new Agent({ id, name: id, instructions: 'Test', model: 'openai/gpt-4o-mini' });
  return createInngestAgent({ agent, inngest });
}

describe('collectInngestFunctions', () => {
  const inngest = new Inngest({ id: 'collect-functions-tests', isDev: true });

  it('serves the loop workflow of a registered Inngest agent even though listWorkflows() hides it', () => {
    const durableAgent = makeInngestAgent(inngest, 'collect-hidden-loop');
    const mastra = new Mastra({ agents: { durableAgent }, logger: false });

    expect(Object.keys(mastra.listWorkflows())).toEqual([]);

    const functions = collectInngestFunctions({ mastra });
    const ids = functions.map(fn => (fn as { id: (prefix?: string) => string }).id());
    expect(ids.some(id => id.includes('durable-agentic-loop'))).toBe(true);
  });

  it('registers the loop workflow once when several Inngest agents are registered', () => {
    const first = makeInngestAgent(inngest, 'collect-multi-a');
    const second = makeInngestAgent(inngest, 'collect-multi-b');
    const mastra = new Mastra({ agents: { first, second }, logger: false });

    const functions = collectInngestFunctions({ mastra });
    const ids = functions.map(fn => (fn as { id: (prefix?: string) => string }).id());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => id.includes('durable-agentic-loop'))).toHaveLength(1);
  });

  it('does not duplicate functions when the loop workflow is also registered under workflows', () => {
    const durableAgent = makeInngestAgent(inngest, 'collect-explicit-loop');
    const loop = durableAgent.getDurableWorkflows()[0]!;
    const mastra = new Mastra({ agents: { durableAgent }, workflows: { loop }, logger: false });

    const functions = collectInngestFunctions({ mastra });
    const ids = functions.map(fn => (fn as { id: (prefix?: string) => string }).id());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some(id => id.includes('durable-agentic-loop'))).toBe(true);
  });
});

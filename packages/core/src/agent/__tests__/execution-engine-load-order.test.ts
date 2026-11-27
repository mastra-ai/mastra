import { describe, expect, it, vi } from 'vitest';

// Each engine class extends a base from another module. When an import cycle reaches an engine
// module before the base finishes loading, importing @mastra/core throws "Class extends value
// undefined". Every case loads a fresh copy of core starting from a different entry module.
const entries = {
  'the base engine': () => import('../execution-engine'),
  'the plain engine': () => import('../plain-execution-engine'),
  'the durable engines': () => import('../durable/execution-engine'),
  'the agent': () => import('../agent'),
  'the durable agent': () => import('../durable/durable-agent'),
};

describe('agent execution engines load from any entry module', () => {
  it.each(Object.entries(entries))('builds every engine when core is first imported through %s', async (_, load) => {
    vi.resetModules();
    await load();
    const { AgentExecutionEngine } = await import('../execution-engine');
    const { PlainAgentExecutionEngine } = await import('../plain-execution-engine');
    const { DefaultAgentExecutionEngine, EventedAgentExecutionEngine } = await import('../durable/execution-engine');

    const engines = [
      new PlainAgentExecutionEngine('agent'),
      new DefaultAgentExecutionEngine('agent'),
      new EventedAgentExecutionEngine('agent'),
    ];

    expect(engines.map(engine => engine instanceof AgentExecutionEngine)).toEqual([true, true, true]);
    expect(engines.map(engine => engine.durable)).toEqual([false, true, true]);
    expect(engines[2]).toBeInstanceOf(DefaultAgentExecutionEngine);
  });
});

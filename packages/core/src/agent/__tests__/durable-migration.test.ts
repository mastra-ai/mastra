import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { Agent } from '../index';
import type { AgentDurableOption, AgentStreamsConfig } from '../index';

const config = { id: 'migration-agent', name: 'Migration Agent', model: 'openai/gpt-4o' } as const;

describe('plain Agent durable migration', () => {
  it('keeps addAgent registration resumable without enabling checkpoint recovery', async () => {
    const mastra = new Mastra();
    const agent = new Agent({ ...config, durable: true });
    mastra.addAgent(agent);

    expect(mastra.getAgentById(agent.id)).toBe(agent);
    expect(agent.hasResumableStreams()).toBe(true);
    await expect(agent.recover('existing-checkpoint')).rejects.toThrow('createDurableAgent');
  });

  it('exports a nameable configuration type for Agent.durable', () => {
    expectTypeOf<AgentStreamsConfig>().toExtend<AgentDurableOption>();
    const durable: AgentStreamsConfig = { cache: false, cleanupTimeoutMs: 0 };
    expect(new Agent({ ...config, durable }).durable).toEqual(durable);
  });

  it.each([
    { maxSteps: 50 },
    { shouldPersistSnapshot: () => true },
    { id: 'legacy-id' },
    { name: 'legacy-name' },
    { maxSteps: 50, id: 'legacy-id', name: 'legacy-name', shouldPersistSnapshot: () => true },
  ])('warns once about ignored JavaScript durable execution options %j', legacy => {
    const mastra = new Mastra();
    const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
    try {
      const agent = new Agent({ ...config, mastra, durable: { cleanupTimeoutMs: 0, ...legacy } });
      mastra.addAgent(agent);
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0]![0];
      for (const key of Object.keys(legacy)) expect(message).toContain(key);
      expect(message).toContain('createDurableAgent');
      expect(message).toContain('streams');
      expect(message).toContain('durable');
      expect(agent.durable).toEqual({ cleanupTimeoutMs: 0, ...legacy });
    } finally {
      warn.mockRestore();
    }
  });

  it.each([undefined, true, false, { cleanupTimeoutMs: 0 }, { cache: false }])(
    'does not warn for supported durable configuration %j',
    durable => {
      const mastra = new Mastra();
      const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
      try {
        mastra.addAgent(new Agent({ ...config, mastra, durable }));
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    },
  );
});

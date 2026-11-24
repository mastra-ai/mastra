import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage';
import { createStep, createWorkflow } from '../workflows';
import { Mastra } from './index';

describe('restartAllActiveWorkflowRuns (#25579)', () => {
  it('does not query storage for opted-out or processor workflows', async () => {
    const noop = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const optedOut = createWorkflow({
      id: 'opted-out',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { autoRestartActiveRuns: false },
    })
      .then(noop)
      .commit();
    const regular = createWorkflow({ id: 'regular', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(noop)
      .commit();
    const support = new Agent({
      id: 'support',
      name: 'support',
      instructions: 'x',
      model: 'openai/gpt-4o-mini',
      inputProcessors: [
        { id: 'a', processInput: async ({ messages }: any) => messages },
        { id: 'b', processInput: async ({ messages }: any) => messages },
      ],
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage, workflows: { optedOut, regular }, agents: { support } });
    await vi.waitFor(() => {
      expect(Object.values(mastra.listWorkflows()).some(workflow => workflow.type === 'processor')).toBe(true);
    });

    const wf = (await storage.getStore('workflows'))!;
    const spy = vi.spyOn(wf, 'listWorkflowRuns');
    await mastra.restartAllActiveWorkflowRuns();

    const queried = spy.mock.calls.map(([args]) => args?.workflowName);
    expect(queried).toContain('regular');
    expect(queried).not.toContain('opted-out');
    expect(queried.some(name => name?.includes('processor'))).toBe(false);
  });
});

import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { CoreToolBuilder } from '../tools/tool-builder/builder';

it('restores transformed background tool input from its workflow snapshot', async () => {
  const storage = new InMemoryStore({ id: 'background-input' });
  const mastra = new Mastra({ storage, logger: false, backgroundTasks: { enabled: true } });
  await mastra.startWorkers();
  const manager = mastra.backgroundTaskManager!;
  let transformations = 0;
  const received: unknown[] = [];
  const build = () =>
    new CoreToolBuilder({
      originalTool: createTool({
        id: 'background-input',
        description: 'Capture input.',
        inputSchema: z.object({
          value: z.string().transform(value => ({ value, count: ++transformations, date: new Date('2026-01-01') })),
        }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.boolean(),
        execute: async (input, context) => {
          received.push(input);
          if (context?.agent?.resumeData !== undefined) return { done: true };
          return context?.agent?.suspend({ question: 'Continue?' });
        },
      }),
      options: { name: 'background-input', mastra, requestContext: new RequestContext() },
    }).buildV5();
  let built = build();
  try {
    const { task } = await manager.enqueue(
      {
        toolName: 'background-input',
        toolCallId: 'background-call',
        args: { value: 'original' },
        agentId: 'agent',
        runId: 'parent',
      },
      {
        executor: {
          execute: async (args, options) =>
            built.execute!(args, { ...options, toolCallId: 'background-call', messages: [] }),
        },
      },
    );
    await vi.waitFor(async () => {
      const current = await manager.getTask(task.id);
      expect(current?.status, JSON.stringify({ current, received, transformations })).toBe('suspended');
    });
    expect((await manager.getTask(task.id))?.suspendPayload).toEqual({ question: 'Continue?' });
    built = build(); // Reconstructed executor cannot retain the previous accepted input.
    await manager.resume(task.id, false);
    await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('completed'));
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual(received[0]);
    expect(transformations).toBe(1);
    expect((await manager.getTask(task.id))?.args).toEqual({ value: 'original' });
  } finally {
    await manager.shutdown();
    await mastra.stopWorkers();
  }
});

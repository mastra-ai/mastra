import { describe, expect, it } from 'vitest';

import { InMemoryStore } from '../storage/mock';
import { TaskStateProcessor } from '../tools/builtin/task-state-processor';
import { taskCheckTool, taskCompleteTool, taskUpdateTool, taskWriteTool } from '../tools/builtin/task-tools';

// Import via the `@mastra/core/signals` entry-point surface (the barrel) so this
// test also exercises that the signals barrel can pull TaskSignalProvider
// without an initialization cycle.
import { TaskSignalProvider } from './index';

describe('TaskSignalProvider', () => {
  it('has a stable id', () => {
    expect(new TaskSignalProvider().id).toBe('task-signals');
  });

  it('exposes the four task tools under their tool ids', () => {
    const tools = new TaskSignalProvider().getTools();
    expect(tools).toEqual({
      task_write: taskWriteTool,
      task_update: taskUpdateTool,
      task_complete: taskCompleteTool,
      task_check: taskCheckTool,
    });
  });

  it('exposes a single TaskStateProcessor input processor', () => {
    const processors = new TaskSignalProvider().getInputProcessors();
    expect(processors).toHaveLength(1);
    expect(processors[0]).toBeInstanceOf(TaskStateProcessor);
  });

  it('returns the same processor instance across calls (stable lane)', () => {
    const provider = new TaskSignalProvider();
    expect(provider.getInputProcessors()[0]).toBe(provider.getInputProcessors()[0]);
  });

  it('the bundled tools and processor read/write the same TaskStore', async () => {
    const provider = new TaskSignalProvider();
    const storage = new InMemoryStore();
    const mastra = { getStorage: () => storage } as any;

    // Mirror how the Agent wires the provider: register Mastra on the processor
    // (the Agent does this via mastra.addProcessor → __registerMastra).
    const processor = provider.getInputProcessors()[0] as TaskStateProcessor;
    processor.__registerMastra(mastra);

    const tools = provider.getTools() as Record<string, { execute: (args: any, ctx: any) => Promise<any> }>;
    const agentCtx = { threadId: 'thread-1', resourceId: 'resource-1', messages: [] };
    const context = { agent: agentCtx, mastra };

    const writeResult = await tools.task_write.execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      context,
    );
    expect(writeResult.isError).toBe(false);
    expect(writeResult.tasks).toHaveLength(1);

    // The processor resolves the same thread-scoped store and projects the list.
    const signal = await processor.computeStateSignal({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      messages: [],
      requestContext: undefined as any,
      contextWindow: { hasSnapshot: true },
      lastSnapshot: undefined,
      activeStateSignals: [],
      deltasSinceSnapshot: [],
    } as any);

    expect(signal).toBeTruthy();
    expect((signal as any).value.tasks).toEqual(writeResult.tasks);
  });

  it('tools no-op without a memory-backed thread', async () => {
    const provider = new TaskSignalProvider();
    const storage = new InMemoryStore();
    const tools = provider.getTools() as Record<string, { execute: (args: any, ctx: any) => Promise<any> }>;

    const result = await tools.task_write.execute(
      { tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
      { agent: {}, mastra: { getStorage: () => storage } as any },
    );

    expect(result.isError).toBe(true);
    expect(result.tasks).toEqual([]);
  });
});

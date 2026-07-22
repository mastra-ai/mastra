import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../mastra';
import { createTool } from '../tools';
import {
  BACKGROUND_WORK_CONTEXT,
  createBackgroundWorkSignalProcessor,
  notifyBackgroundWorkTerminal,
} from './background-work-signals';

const createProcessorArgs = (overrides: Record<string, unknown>) => {
  const { mastra = new Mastra(), ...args } = overrides;
  const runId = (args.runId as string | undefined) ?? 'run-1';
  if (!(mastra as Mastra).__getRunScope(runId)) {
    (mastra as Mastra).__createRunScope(runId);
  }
  return {
    runId,
    sendSignal: vi.fn(),
    tools: {},
    agent: { getMastraInstance: () => mastra },
    ...args,
  } as any;
};

describe('createBackgroundWorkSignalProcessor', () => {
  it('preserves wrapper identity within a run and creates a fresh caller binding across runs', async () => {
    const tool = createTool({
      id: 'lookup',
      description: 'lookup',
      inputSchema: z.object({ query: z.string() }),
      execute: vi.fn(async ({ query }) => query),
    });
    const processor = createBackgroundWorkSignalProcessor();
    const mastra = new Mastra();

    const first = (await processor.processInputStep!(createProcessorArgs({ mastra, tools: { lookup: tool } }))) as any;
    const second = (await processor.processInputStep!(createProcessorArgs({ mastra, tools: { lookup: tool } }))) as any;
    const otherRun = (await processor.processInputStep!(
      createProcessorArgs({ mastra, runId: 'run-2', tools: { lookup: tool } }),
    )) as any;

    expect(first.tools!.lookup).toBe(second.tools!.lookup);
    expect(first.tools!.lookup).not.toBe(otherRun.tools!.lookup);
    expect((first.tools!.lookup as typeof tool).inputSchema).toBe(tool.inputSchema);
    expect((first.tools!.lookup as typeof tool).execute).not.toBe(tool.execute);
  });

  it('delivers one terminal signal only after the native reconciliation hook invokes it', async () => {
    const sendSignal = vi.fn(async signal => ({ ...signal, __isCreatedSignal: true }));
    const execute = vi.fn(async () => 'result');
    const tool = createTool({ id: 'lookup', description: 'lookup', execute });
    const processor = createBackgroundWorkSignalProcessor();
    const mastra = new Mastra();
    mastra.__createRunScope('run-1');

    const processed = (await processor.processInputStep!(
      createProcessorArgs({ mastra, sendSignal, tools: { lookup: tool } }),
    )) as any;
    const wrapped = processed.tools!.lookup as typeof tool;
    await wrapped.execute!({}, {
      mastra,
      toolCallId: 'call-1',
      [BACKGROUND_WORK_CONTEXT]: {
        originRunId: 'run-1',
        originToolCallId: 'call-1',
        invocationKind: 'tool',
        disposition: 'deferred',
      },
    } as any);

    expect(sendSignal).not.toHaveBeenCalled();

    const payload = {
      originRunId: 'run-1',
      originToolCallId: 'call-1',
      taskId: 'task-1',
      invocationKind: 'tool' as const,
      disposition: 'deferred' as const,
      status: 'completed' as const,
    };
    await notifyBackgroundWorkTerminal(mastra, payload);
    await notifyBackgroundWorkTerminal(mastra, payload);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification',
        tagName: 'work-completed',
        metadata: payload,
      }),
    );
    mastra.__releaseRunScope('run-1');
  });

  it('fails closed when the originating scope is released', async () => {
    const sendSignal = vi.fn();
    const tool = createTool({ id: 'lookup', description: 'lookup', execute: async () => 'result' });
    const processor = createBackgroundWorkSignalProcessor();
    const mastra = new Mastra();
    mastra.__createRunScope('run-1');

    const processed = (await processor.processInputStep!(
      createProcessorArgs({ mastra, sendSignal, tools: { lookup: tool } }),
    )) as any;
    await (processed.tools!.lookup as typeof tool).execute!({}, {
      mastra,
      toolCallId: 'call-1',
      [BACKGROUND_WORK_CONTEXT]: {
        originRunId: 'run-1',
        originToolCallId: 'call-1',
        invocationKind: 'tool',
        disposition: 'deferred',
      },
    } as any);
    mastra.__releaseRunScope('run-1');

    await notifyBackgroundWorkTerminal(mastra, {
      originRunId: 'run-1',
      originToolCallId: 'call-1',
      taskId: 'task-1',
      invocationKind: 'tool',
      disposition: 'deferred',
      status: 'completed',
    });

    expect(sendSignal).not.toHaveBeenCalled();
    expect(mastra.__getRunScope('run-1')).toBeUndefined();
  });

  it('does not retry a rejected terminal signal', async () => {
    const sendSignal = vi.fn().mockRejectedValue(new Error('closed writer'));
    const tool = createTool({ id: 'lookup', description: 'lookup', execute: async () => 'result' });
    const processor = createBackgroundWorkSignalProcessor();
    const mastra = new Mastra();
    mastra.__createRunScope('run-1');

    const processed = (await processor.processInputStep!(
      createProcessorArgs({ mastra, sendSignal, tools: { lookup: tool } }),
    )) as any;
    await (processed.tools!.lookup as typeof tool).execute!({}, {
      mastra,
      toolCallId: 'call-1',
      [BACKGROUND_WORK_CONTEXT]: {
        originRunId: 'run-1',
        originToolCallId: 'call-1',
        invocationKind: 'tool',
        disposition: 'deferred',
      },
    } as any);

    const payload = {
      originRunId: 'run-1',
      originToolCallId: 'call-1',
      taskId: 'task-1',
      invocationKind: 'tool' as const,
      disposition: 'deferred' as const,
      status: 'failed' as const,
    };
    await notifyBackgroundWorkTerminal(mastra, payload);
    await notifyBackgroundWorkTerminal(mastra, payload);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    mastra.__releaseRunScope('run-1');
  });
});

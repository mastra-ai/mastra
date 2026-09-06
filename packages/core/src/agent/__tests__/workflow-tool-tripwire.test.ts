import dns from 'node:dns';
import net from 'node:net';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraLanguageModelV2Mock } from '../../loop/test-utils/MastraLanguageModelV2Mock';
import { Mastra } from '../../mastra';
import type { Processor } from '../../processors';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

const tripwire = {
  reason: 'The child policy blocked this result',
  retry: false,
  metadata: { category: 'test-policy', detail: { retained: ['exact', 0, false] } },
  processorId: 'child-policy',
};

function modelReply(tool: boolean) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      ...(tool
        ? [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'workflow-child',
              input: JSON.stringify({ inputData: { prompt: 'test' } }),
            },
          ]
        : [
            { type: 'text-start' as const, id: 'text' },
            { type: 'text-delta' as const, id: 'text', delta: 'Done' },
            { type: 'text-end' as const, id: 'text' },
          ]),
      {
        type: 'finish' as const,
        finishReason: tool ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]),
  };
}

function createModel(next: () => boolean) {
  return new MastraLanguageModelV2Mock({
    doStream: async () => modelReply(next()),
    doGenerate: async () => {
      const tool = next();
      return {
        content: tool
          ? [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'workflow-child',
                input: JSON.stringify({ inputData: { prompt: 'test' } }),
              },
            ]
          : [{ type: 'text', text: 'Done' }],
        finishReason: tool ? 'tool-calls' : 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
  });
}

describe('workflow tool tripwire results', () => {
  let networkAttempts = 0;

  beforeEach(() => {
    networkAttempts = 0;
    const block = () => {
      networkAttempts++;
      throw new Error('External network forbidden');
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(block);
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(block);
    vi.spyOn(dns, 'lookup').mockImplementation(block);
  });

  afterEach(() => {
    expect(networkAttempts).toBe(0);
    vi.restoreAllMocks();
  });

  async function fixture(mode: 'tripwire' | 'failed' | 'success', guard = false, suspendFirst = false) {
    let parentCalls = 0;
    let childCalls = 0;
    let followingCalls = 0;
    const observed: unknown[] = [];
    const childAgent = new Agent({
      id: 'child',
      name: 'Child',
      instructions: 'Answer',
      model: createModel(() => {
        childCalls++;
        return false;
      }),
      inputProcessors:
        mode === 'tripwire'
          ? [
              {
                id: tripwire.processorId,
                processInput({ abort }) {
                  abort(tripwire.reason, { retry: tripwire.retry, metadata: tripwire.metadata });
                },
              },
            ]
          : [],
    });
    const first =
      mode === 'failed'
        ? createStep({
            id: 'failure',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ text: z.string() }),
            execute: async () => {
              throw new Error('Ordinary workflow failure');
            },
          })
        : createStep(childAgent, { maxSteps: 1, maxRetries: 0 });
    const workflow = createWorkflow({
      id: 'child-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(
        createStep({
          id: 'gate',
          inputSchema: z.object({ prompt: z.string() }),
          outputSchema: z.object({ prompt: z.string() }),
          resumeSchema: z.object({ allow: z.boolean() }),
          suspendSchema: z.object({ request: z.string() }),
          execute: async ({ inputData, resumeData, suspend }) => {
            if (suspendFirst && !resumeData) return suspend({ request: 'Continue?' });
            return inputData;
          },
        }),
      )
      .then(first)
      .then(
        createStep({
          id: 'following',
          inputSchema: z.object({ text: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          execute: async ({ inputData }) => {
            followingCalls++;
            return inputData;
          },
        }),
      )
      .commit();
    const policy: Processor = {
      id: 'parent-policy',
      processToolResult({ result, abort }) {
        observed.push(result);
        if (guard && result && typeof result === 'object' && 'status' in result && result.status === 'tripwire') {
          abort('Parent policy blocked the child result', { retry: false });
        }
      },
    };
    const parent = new Agent({
      id: 'parent',
      name: 'Parent',
      instructions: 'Use child then answer',
      workflows: { child: workflow },
      outputProcessors: [policy],
      model: createModel(() => {
        parentCalls++;
        return parentCalls === 1;
      }),
    });
    const mastra = new Mastra({
      agents: { parent, childAgent },
      workflows: { child: workflow },
      storage: new MockStore(),
      logger: false,
      workers: false,
      scheduler: { enabled: false },
      recovery: { durableAgents: 'off' },
    });
    await mastra.startWorkers();
    return { parent, mastra, workflow, observed, counts: () => ({ parentCalls, childCalls, followingCalls }) };
  }

  it.each(['generate', 'stream'] as const)(
    'preserves typed child tripwire in %s without changing parent policy',
    async method => {
      const f = await fixture('tripwire');
      try {
        const output =
          method === 'generate'
            ? await f.parent.generate('Start', { maxSteps: 3 })
            : await (await f.parent.stream('Start', { maxSteps: 3 })).getFullOutput();
        expect(f.observed).toEqual([{ status: 'tripwire', tripwire, runId: expect.any(String) }]);
        expect(f.counts()).toEqual({ parentCalls: 2, childCalls: 0, followingCalls: 0 });
        expect(output.tripwire).toBeUndefined();
      } finally {
        await f.mastra.shutdown();
      }
    },
  );

  it.each(['generate', 'stream'] as const)(
    'lets the native parent processor stop %s after inspecting typed result',
    async method => {
      const f = await fixture('tripwire', true);
      try {
        const output =
          method === 'generate'
            ? await f.parent.generate('Start', { maxSteps: 3 })
            : await (await f.parent.stream('Start', { maxSteps: 3 })).getFullOutput();
        expect(f.observed).toEqual([{ status: 'tripwire', tripwire, runId: expect.any(String) }]);
        expect(f.counts()).toEqual({ parentCalls: 1, childCalls: 0, followingCalls: 0 });
        expect(output.tripwire).toMatchObject({
          reason: 'Parent policy blocked the child result',
          retry: false,
          processorId: 'parent-policy',
        });
      } finally {
        await f.mastra.shutdown();
      }
    },
  );

  it.each(['generate', 'stream'] as const)(
    'keeps ordinary workflow failures as ordinary tool results in %s',
    async method => {
      const f = await fixture('failed', true);
      try {
        const output =
          method === 'generate'
            ? await f.parent.generate('Start', { maxSteps: 3 })
            : await (await f.parent.stream('Start', { maxSteps: 3 })).getFullOutput();
        expect(f.observed).toEqual([{ error: 'Ordinary workflow failure', runId: expect.any(String) }]);
        expect(f.counts()).toEqual({ parentCalls: 2, childCalls: 0, followingCalls: 0 });
        expect(output.tripwire).toBeUndefined();
      } finally {
        await f.mastra.shutdown();
      }
    },
  );

  it('keeps successful workflow results unchanged', async () => {
    const f = await fixture('success', true);
    try {
      await f.parent.generate('Start', { maxSteps: 3 });
      expect(f.observed).toEqual([{ result: { text: 'Done' }, runId: expect.any(String) }]);
      expect(f.counts()).toEqual({ parentCalls: 2, childCalls: 1, followingCalls: 1 });
    } finally {
      await f.mastra.shutdown();
    }
  });

  it.each(['generate', 'stream'] as const)(
    'preserves tripwire when the workflow tool resumes a suspended run in %s',
    async methodType => {
      const f = await fixture('tripwire', false, true);
      try {
        const run = await f.workflow.createRun();
        const suspended = await run.start({ inputData: { prompt: 'test' } });
        expect(suspended.status).toBe('suspended');
        expect(f.counts()).toEqual({ parentCalls: 0, childCalls: 0, followingCalls: 0 });
        const tools = await f.parent.getToolsForExecution({ methodType });
        const result = await tools['workflow-child']!.execute!(
          { inputData: { prompt: 'test' }, suspendedToolRunId: run.runId },
          {
            toolCallId: 'resume-call',
            messages: [],
            resumeData: { allow: true },
            abortSignal: new AbortController().signal,
          } as never,
        );
        expect(result).toEqual({ status: 'tripwire', tripwire, runId: run.runId });
        expect(f.counts()).toEqual({ parentCalls: 0, childCalls: 0, followingCalls: 0 });
      } finally {
        await f.mastra.shutdown();
      }
    },
  );
});

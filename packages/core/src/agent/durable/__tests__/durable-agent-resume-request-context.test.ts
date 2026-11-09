/**
 * Regression test for #25960 on the durable agent: an approved tool must run
 * with the request context passed to approveToolCall, not the one the run
 * suspended with.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const answered = prompt.some(message => message.role === 'tool');
      const parts = answered
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'whoami', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function startProcess(storage: InMemoryStore, seen: unknown[], { withholdTool = false } = {}) {
  globalRunRegistry.clear();
  const agent = new Agent({
    id: 'who-agent',
    name: 'who-agent',
    instructions: 'Use your tools.',
    model: createModel(),
    tools: {
      whoami: createTool({
        id: 'whoami',
        description: 'Reports the caller',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async (_input, context) => {
          seen.push(context?.requestContext?.get('who'));
          return { ok: true };
        },
      }),
      secret: createTool({
        id: 'secret',
        description: 'Withheld by a processor in the withhold case',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      }),
    },
    inputProcessors: withholdTool
      ? [
          {
            id: 'withhold-secret',
            processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => {
              const { secret: _secret, ...rest } = tools ?? {};
              return { tools: rest };
            },
          },
        ]
      : undefined,
  });
  const durableAgent = createDurableAgent({ agent });
  new Mastra({ agents: { durableAgent }, storage, logger: false });
  return durableAgent;
}

function contextFor(who: string) {
  const requestContext = new RequestContext();
  requestContext.set('who', who);
  return requestContext;
}

async function suspendForApproval(options?: { withholdTool?: boolean }) {
  const storage = new InMemoryStore();
  const seen: unknown[] = [];
  const durableAgent = startProcess(storage, seen, options);
  const stream = await durableAgent.stream('Who am I?', { requestContext: contextFor('first') });

  let toolCallId: string | undefined;
  for await (const chunk of stream.fullStream as AsyncIterable<any>) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
      break;
    }
  }
  expect(toolCallId).toBeTruthy();
  const workflows = (await storage.getStore('workflows'))!;
  await vi.waitFor(async () => {
    const run = await workflows.getWorkflowRunById({ runId: stream.runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    expect((run?.snapshot as any)?.status).toBe('suspended');
  });

  return { durableAgent, storage, seen, runId: stream.runId, toolCallId: toolCallId! };
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

describe('durable agent approval resume request context (#25960)', () => {
  it('runs the approved tool with the request context passed to approveToolCall in a fresh process', async () => {
    const run = await suspendForApproval();
    const durableAgent = startProcess(run.storage, run.seen);

    await drain(
      await durableAgent.approveToolCall({
        runId: run.runId,
        toolCallId: run.toolCallId,
        requestContext: contextFor('second'),
      }),
    );

    expect(run.seen).toEqual(['second']);
  });

  it('does not restore a tool an input processor withheld when approved in the same process', async () => {
    const run = await suspendForApproval({ withholdTool: true });
    expect(globalRunRegistry.get(run.runId)?.tools).not.toHaveProperty('secret');

    const stream = await run.durableAgent.approveToolCall({
      runId: run.runId,
      toolCallId: run.toolCallId,
      requestContext: contextFor('second'),
    });
    expect(globalRunRegistry.get(run.runId)?.tools).not.toHaveProperty('secret');
    await drain(stream);

    expect(run.seen).toEqual(['second']);
  });
});

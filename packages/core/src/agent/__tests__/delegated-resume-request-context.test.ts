import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for #25960: an in-process supervisor resume ran the first
 * request's delegation hooks and sub-agent tools with the first request's
 * requestContext instead of the ones passed to resumeStream.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function toolResultCount(prompt: Array<{ role: string }>) {
  return prompt.filter(message => message.role === 'tool').length;
}

function reply(chunks: unknown[]) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks] as any),
  };
}

function toolCall(toolCallId: string, toolName: string, input: unknown) {
  return [
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];
}

function text(value: string) {
  return [
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: value },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

describe('delegated resume request context (#25960)', () => {
  it('uses the requestContext and delegation hooks passed to each in-process resumeStream call', async () => {
    const seen: string[] = [];

    const ping = createTool({
      id: 'ping',
      description: 'Ping',
      inputSchema: z.object({ n: z.number() }),
      requireApproval: true,
      execute: async ({ n }, context) => {
        seen.push(`tool ping #${n} turn ${context?.requestContext?.get('turn')}`);
        return { pong: n };
      },
    });

    const worker = new Agent({
      id: 'worker',
      name: 'worker',
      description: 'Pings',
      instructions: 'Ping twice.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          const done = toolResultCount(prompt);
          if (done === 0) return reply(toolCall('ping-1', 'ping', { n: 1 }));
          if (done === 1) return reply(toolCall('ping-2', 'ping', { n: 2 }));
          return reply(text('both pings done'));
        },
      }),
      tools: { ping },
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate to worker.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) =>
          toolResultCount(prompt) === 0
            ? reply(toolCall('delegate-1', 'agent-worker', { prompt: 'ping twice' }))
            : reply(text('supervisor done')),
      }),
      agents: { worker },
    });

    new Mastra({ agents: { supervisor, worker }, logger: false, storage: new InMemoryStore() });

    function requestFor(turn: number) {
      const requestContext = new RequestContext();
      requestContext.set('turn', turn);
      return {
        requestContext,
        delegation: {
          onDelegationStart: (ctx: { requestContext: RequestContext }) => {
            seen.push(`hook built for turn ${turn} sees turn ${ctx.requestContext.get('turn')}`);
            return { proceed: true };
          },
        },
      };
    }

    async function pendingApproval(stream: any) {
      let toolCallId: string | undefined;
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
      }
      return toolCallId;
    }

    const first = await supervisor.stream('ping twice', requestFor(1));
    const runId = first.runId;
    expect(await pendingApproval(first)).toBe('delegate-1');

    const resume1 = await supervisor.resumeStream(
      { approved: true },
      { ...requestFor(2), runId, toolCallId: 'delegate-1' },
    );
    expect(await pendingApproval(resume1)).toBe('delegate-1');

    const resume2 = await supervisor.resumeStream(
      { approved: true },
      { ...requestFor(3), runId, toolCallId: 'delegate-1' },
    );
    expect(await pendingApproval(resume2)).toBeUndefined();

    expect(seen).toEqual([
      'hook built for turn 1 sees turn 1',
      'hook built for turn 2 sees turn 2',
      'tool ping #1 turn 2',
      'hook built for turn 3 sees turn 3',
      'tool ping #2 turn 3',
    ]);
  });

  it('keeps a tool added by an input processor when an in-process resume approves its call', async () => {
    const seen: string[] = [];

    const added = createTool({
      id: 'added',
      description: 'Added by a processor',
      inputSchema: z.object({ n: z.number() }),
      requireApproval: true,
      execute: async ({ n }) => {
        seen.push(`added #${n}`);
        return { ok: n };
      },
    });

    const agent = new Agent({
      id: 'with-processor',
      name: 'with-processor',
      instructions: 'Call added.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) =>
          toolResultCount(prompt) === 0 ? reply(toolCall('added-1', 'added', { n: 1 })) : reply(text('done')),
      }),
      inputProcessors: [
        {
          id: 'add-tool',
          processInputStep: async ({ tools }: { tools?: Record<string, unknown> }) => ({ tools: { ...tools, added } }),
        } as any,
      ],
    });

    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

    const first = await agent.stream('call added');
    let toolCallId: string | undefined;
    for await (const chunk of first.fullStream) {
      if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    }
    expect(toolCallId).toBe('added-1');

    const resumed = await agent.resumeStream({ approved: true }, { runId: first.runId, toolCallId: 'added-1' });
    for await (const _chunk of resumed.fullStream) {
    }

    expect(seen).toEqual(['added #1']);
  });
});

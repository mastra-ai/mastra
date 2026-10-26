/**
 * Two approval tool calls in one model step (#28479).
 *
 * The first stream stops at the first approval. Approving it with
 * `closeOnSuspend: true` runs that tool and re-suspends on the second approval;
 * the resumed stream must carry those chunks before it closes. On a transport
 * that redelivers retained frames to a resumed subscriber (Redis Streams), the
 * stream used to close before the resumed segment's frames reached it.
 *
 * Shared so every PubSub transport runs the same scenario. Lives with
 * @mastra/core's tests; there is no public export.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { PubSub } from '../../../events/pubsub';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

export interface SiblingApprovalSuiteOptions {
  /** A fresh transport per test; the suite wraps it in the agent's CachingPubSub. */
  createPubSub(): PubSub | Promise<PubSub>;
  cleanup?(): Promise<void>;
  /** Repeats per engine, to catch a race that only shows up some of the time. */
  repeat?: number;
}

type Chunk = { type: string; payload?: { toolCallId?: string } };

const label = (chunk: Chunk) =>
  chunk.type === 'tool-call-approval' ? `tool-call-approval(${chunk.payload?.toolCallId})` : chunk.type;

async function read(output: { fullStream: AsyncIterable<unknown> }): Promise<string[]> {
  const seen: string[] = [];
  for await (const chunk of output.fullStream) seen.push(label(chunk as Chunk));
  return seen;
}

export function defineSiblingApprovalSuite(name: string, options: SiblingApprovalSuiteOptions) {
  const repeat = options.repeat ?? 1;
  let llm: LLMock;
  const pubsubs: PubSub[] = [];

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call-alice', name: 'send_money', arguments: { to: 'alice' } },
          { id: 'call-bob', name: 'send_money', arguments: { to: 'bob' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
  });

  afterAll(async () => {
    await llm?.stop();
  });

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    await options.cleanup?.();
  });

  describe.each(['durable', 'evented'] as const)(`${name}: %s agent, two approvals in one step`, engine => {
    it.each(Array.from({ length: repeat }, (_, i) => i + 1))(
      'resumeStream(closeOnSuspend) streams the resumed tool and the second approval (run %i)',
      async () => {
        const ran: string[] = [];
        const agent = new Agent({
          id: 'payer',
          name: 'payer',
          instructions: 'Pay everyone.',
          model: createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
          tools: {
            send_money: createTool({
              id: 'send_money',
              description: 'Send money',
              requireApproval: true,
              inputSchema: z.object({ to: z.string() }),
              execute: async ({ to }) => {
                ran.push(to);
                return { sent: to };
              },
            }),
          },
        });
        const pubsub = await options.createPubSub();
        pubsubs.push(pubsub);
        const durable =
          engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });
        const mastra = new Mastra({ agents: { payer: durable }, storage: new InMemoryStore(), logger: false });
        const payer = mastra.getAgent('payer');

        const start = await payer.stream('Pay alice and bob', { closeOnSuspend: true } as never);
        const first = await read(start);
        expect(first.filter(type => type.startsWith('tool-call-approval'))).toEqual(['tool-call-approval(call-alice)']);

        const resumed = await payer.resumeStream(
          { approved: true },
          { runId: start.runId, toolCallId: 'call-alice', closeOnSuspend: true },
        );
        const second = await read(resumed);

        expect(ran).toEqual(['alice']);
        expect(second.filter(type => type !== 'start' && type !== 'step-start')).toEqual(
          expect.arrayContaining(['tool-call-resumed', 'tool-result', 'tool-call-approval(call-bob)']),
        );
        expect(second.indexOf('tool-result')).toBeLessThan(second.indexOf('tool-call-approval(call-bob)'));
      },
      30_000,
    );
  });
}

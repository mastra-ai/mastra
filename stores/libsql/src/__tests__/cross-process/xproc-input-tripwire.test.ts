import { randomUUID } from 'node:crypto';

import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { InputTripwirePeerArgs, InputTripwirePeerCounts } from './fixtures/input-tripwire-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import { createStepAgent } from './step-agent';

const WORKER = new URL('./fixtures/input-tripwire-peer.ts', import.meta.url);
const FINAL_TEXT = 'The dedicated worker called the model';
const TRIPWIRE = {
  reason: 'Deploy preflight rejected this request',
  retry: false,
  processorId: 'deploy-preflight',
  metadata: { code: 'invalid-target', target: { environment: 'staging' } },
};

async function guarded<T>(promise: Promise<T>, context: () => string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Dedicated worker run did not settle\n${context()}`)),
          DEFAULT_HANG_GUARD_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('evented input tripwire with a dedicated worker', () => {
  it(
    'carries the API processor decision to the worker without calling the model or replaying processInput',
    async () => {
      const env = await createXprocEnv({ workers: false });
      const agentId = `input-tripwire-${randomUUID()}`;
      let inputCalls = 0;
      const { agent, modelCalls } = createStepAgent({
        id: agentId,
        steps: 0,
        finalText: FINAL_TEXT,
        inputProcessors: [
          {
            id: TRIPWIRE.processorId,
            processInput: ({ messages, requestContext, abort }) => {
              inputCalls++;
              if (requestContext.get('blocked')) {
                abort(TRIPWIRE.reason, { retry: TRIPWIRE.retry, metadata: TRIPWIRE.metadata });
              }
              return messages;
            },
          },
        ],
      });
      const runner = createEventedAgent({ agent });
      const storage = new LibSQLStore({ id: 'input-tripwire-api', url: env.dbUrl });
      const mastra = new Mastra({
        agents: { [agentId]: runner },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        workers: false,
      });
      try {
        const peer = await env.spawnPeer(
          WORKER,
          { agentId, finalText: FINAL_TEXT, tripwire: TRIPWIRE } satisfies InputTripwirePeerArgs,
          { role: 'input-tripwire-worker', workers: true },
        );
        await peer.waitFor('worker-ready');
        expect(peer.pid).not.toBe(process.pid);
        expect(peer.workers).toBe(true);

        for (let run = 0; run < 3; run++) {
          const blocked = run > 0;
          const chunks: Array<{ type: string; payload?: unknown }> = [];
          const result = await runner.stream('Check this deploy target', {
            runId: `input-tripwire-${randomUUID()}`,
            requestContext: new RequestContext([['blocked', blocked]]),
          });
          const output = await guarded(
            (async () => {
              for await (const chunk of result.fullStream) chunks.push(chunk);
              return result.output.getFullOutput();
            })(),
            () => `${JSON.stringify({ run, inputCalls, modelCalls: modelCalls(), chunks })}\n${env.describe()}`,
          );
          peer.send(`inspect-${run}`);
          const counts = await peer.waitFor<InputTripwirePeerCounts>(`counts-${run}`);

          expect(counts.pid).toBe(peer.pid);
          expect(counts.inputCalls).toBe(0);
          expect(inputCalls).toBe(run + 1);
          expect(modelCalls()).toBe(0);
          if (!blocked) {
            // Without this control a dead worker would make zero-call assertions vacuous.
            expect(counts.modelCalls).toBe(1);
            expect(output.text).toBe(FINAL_TEXT);
            expect(output.finishReason).toBe('stop');
            expect(chunks.map(chunk => chunk.type)).toContain('text-delta');
          } else {
            expect.soft(chunks.map(chunk => chunk.type)).toEqual(['start', 'tripwire']);
            expect.soft(chunks.find(chunk => chunk.type === 'tripwire')?.payload).toEqual(TRIPWIRE);
            expect.soft(counts.modelCalls).toBe(1);
            expect.soft(output.text).toBe('');
            expect.soft(output.tripwire).toEqual(TRIPWIRE);
          }
        }
        peer.send('finish');
        await peer.result();
        expect(await peer.exit()).toEqual({ code: 0, signal: null });
      } finally {
        await mastra.shutdown();
        await storage.close();
        await env.cleanup();
      }
    },
    PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS * 3 + 10_000,
  );
});

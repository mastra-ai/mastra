import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { LibSQLStore } from '../../storage';
import type { T80PeerArgs, T80PeerResult } from './fixtures/t80-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { createStepAgent, gate } from './step-agent';

const PEER_FIXTURE = new URL('./fixtures/t80-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;
const ANSWER = { answer: 'ok', n: 3 };
const ANSWER_TEXT = JSON.stringify(ANSWER);

type CellSpec = {
  condition: 'durable' | 'evented' | 'xproc-durable' | 'xproc-evented';
  engine: 'durable' | 'evented';
  xproc: boolean;
};

const CELLS: CellSpec[] = [
  { condition: 'durable', engine: 'durable', xproc: false },
  { condition: 'evented', engine: 'evented', xproc: false },
  { condition: 'xproc-durable', engine: 'durable', xproc: true },
  { condition: 'xproc-evented', engine: 'evented', xproc: true },
];

function withHangGuard<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${message} (hang guard)`)), DEFAULT_HANG_GUARD_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function collectChunkTypes(stream: ReadableStream<any>): Promise<string[]> {
  const types: string[] = [];
  for await (const chunk of stream) types.push(chunk.type);
  return types;
}

for (const spec of CELLS) {
  describe(`T80 ${spec.condition}: observe structured output`, () => {
    let env: XprocEnv | undefined;
    let storage: LibSQLStore | undefined;
    let mastra: Mastra | undefined;

    beforeEach(async () => {
      env = spec.xproc ? await createXprocEnv() : undefined;
    });

    afterEach(async () => {
      try {
        await mastra?.shutdown();
        mastra = undefined;
      } finally {
        try {
          await storage?.close();
          storage = undefined;
        } finally {
          await env?.cleanup();
          env = undefined;
        }
      }
    });

    it(
      'reconstructs the producer object from the observed JSON text',
      async () => {
        const id = randomUUID();
        const agentId = `t80-${spec.condition}-${id}`;
        const runId = `t80-run-${id}`;
        const reached = gate();
        const release = gate();
        const { agent } = createStepAgent({
          id: agentId,
          steps: 2,
          blockAt: 2,
          release: release.promise,
          finalText: ANSWER_TEXT,
          onToolEvent: event => {
            if (event.event === 'reached') reached.resolve();
          },
        });
        const runner = spec.engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
        const xprocEnv = env;
        if (spec.xproc && !xprocEnv) throw new Error(`${spec.condition}: missing cross-process environment`);

        storage = new LibSQLStore({
          id: `t80-${spec.condition}-main-${id}`,
          url: xprocEnv?.dbUrl ?? ':memory:',
        });
        mastra = new Mastra({
          agents: { t80: runner },
          storage,
          logger: false,
          ...(xprocEnv ? { pubsub: xprocEnv.pubsub() } : {}),
        });
        expect(mastra.getAgent('t80') as unknown).toBe(runner);

        const peer = xprocEnv
          ? await xprocEnv.spawnPeer<T80PeerArgs>(
              PEER_FIXTURE,
              { engine: spec.engine, agentId, runId, finalText: ANSWER_TEXT },
              { role: `observer-${spec.engine}`, workers: false },
            )
          : undefined;

        const producer = await runner.stream('Return the structured answer', {
          runId,
          maxSteps: 4,
          structuredOutput: {
            schema: z.object({ answer: z.string(), n: z.number() }),
          },
        });
        const producerChunks = collectChunkTypes(producer.fullStream);
        const producerOutput = producer.output.getFullOutput();

        await withHangGuard(reached.promise, 'step 2 never reached its gate');

        let observerResult: T80PeerResult;
        if (peer) {
          const peerResult = peer.result<T80PeerResult>();
          peer.send('run-live', { runId });
          await Promise.race([peer.waitFor('observer-attached'), peerResult]);
          release.resolve();
          observerResult = await peerResult;
          expect(await peer.exit()).toEqual({ code: 0, signal: null });
        } else {
          const observer = await runner.observe(runId);
          const observerChunks = collectChunkTypes(observer.fullStream);
          const observerOutput = observer.output.getFullOutput();
          release.resolve();
          const output = await observerOutput;
          observerResult = {
            runId,
            text: output.text,
            finishReason: output.finishReason,
            object: output.object,
            chunkTypes: await observerChunks,
          };
        }

        const produced = await withHangGuard(producerOutput, 'producer output did not settle');
        const producerChunkTypes = await withHangGuard(producerChunks, 'producer stream did not settle');

        expect(produced.text).toBe(ANSWER_TEXT);
        expect(produced.finishReason).toBe('stop');
        expect(produced.object).toEqual(ANSWER);
        expect(producerChunkTypes).toContain('object');
        expect(producerChunkTypes).toContain('object-result');
        expect(observerResult.text).toBe(produced.text);
        expect(observerResult.finishReason).toBe(produced.finishReason);
        expect(observerResult.object).toEqual(produced.object);
        expect(observerResult.chunkTypes).toContain('object');
        expect(observerResult.chunkTypes).toContain('object-result');
      },
      CELL_TIMEOUT_MS,
    );
  });
}

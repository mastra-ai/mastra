import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { Cor1411PeerArgs, Cor1411PeerResult } from './fixtures/cor1411-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { createStepAgent, gate } from './step-agent';

const PEER_FIXTURE = new URL('./fixtures/cor1411-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;
const PROMPT = 'Return the cross-process observer answer';
const FINAL_TEXT = 'final answer';

const uppercaser = (onCall: () => void) => ({
  id: 'uppercaser',
  name: 'Uppercaser',
  processOutputStream: async ({ part }: { part: any }) => {
    onCall();
    if (part.type === 'text-delta' && typeof part.payload?.text === 'string') {
      return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
    }
    return part;
  },
});

// With `recovery: 'auto'` the producer persists running snapshots. An observer that
// rebuilt its transcript from them on every step read an older transcript (the
// attach-time iteration, or a snapshot written after the step it was rebuilding),
// without the final answer.
const cells = (['durable', 'evented'] as const).flatMap(engine =>
  [false, true].map(persistRunning => ({ engine, persistRunning })),
);

for (const { engine, persistRunning } of cells) {
  describe(`COR-1411 xproc-${engine}${persistRunning ? ' (running snapshots)' : ''}: observe output state`, () => {
    let env: XprocEnv;
    let storage: LibSQLStore | undefined;
    let mastra: Mastra | undefined;

    beforeEach(async () => {
      env = await createXprocEnv();
    });

    afterEach(async () => {
      try {
        await mastra?.shutdown();
      } finally {
        try {
          await storage?.close();
        } finally {
          await env.cleanup();
        }
      }
    });

    const runObserved = async (returnScorerData?: true, failRunReadsAfterAttach = false) => {
      const id = randomUUID();
      const agentId = `cor1411-${engine}-${id}`;
      const runId = `cor1411-run-${id}`;
      const reached = gate();
      const release = gate();
      let producerProcessorCalls = 0;
      const { agent } = createStepAgent({
        id: agentId,
        steps: 2,
        blockAt: 2,
        release: release.promise,
        finalText: FINAL_TEXT,
        onToolEvent: event => {
          if (event.event === 'reached') reached.resolve();
        },
        outputProcessors: [uppercaser(() => (producerProcessorCalls += 1))],
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
      storage = new LibSQLStore({ id: `cor1411-${engine}-main-${id}`, url: env.dbUrl });
      mastra = new Mastra({
        agents: { producer: runner },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        ...(persistRunning ? { recovery: { durableAgents: 'auto' as const } } : {}),
      });

      const peer = await env.spawnPeer<Cor1411PeerArgs>(
        PEER_FIXTURE,
        { engine, agentId, runId, finalText: FINAL_TEXT, prompt: PROMPT, failRunReadsAfterAttach },
        { role: `observer-${engine}`, workers: false },
      );
      const producer = await runner.stream(PROMPT, {
        runId,
        maxSteps: 4,
        ...(returnScorerData ? { returnScorerData } : {}),
        requestContext: new RequestContext([['tenantId', 'persisted-tenant']]),
      });
      const producerOutput = producer.output.getFullOutput();

      await reached.promise;
      const peerResult = peer.result<Cor1411PeerResult>();
      peer.send('run-live', { runId });
      await Promise.race([peer.waitFor('observer-attached'), peerResult]);
      release.resolve();

      const produced = await producerOutput;
      const observed = await peerResult;
      expect(await peer.exit()).toEqual({ code: 0, signal: null });
      return { observed, produced, producerProcessorCalls };
    };

    it(
      'rehydrates configured processors, request context, and scorer data without reprocessing marked chunks',
      async () => {
        const { observed, produced, producerProcessorCalls } = await runObserved(true);

        expect(produced.text).toBe(FINAL_TEXT.toUpperCase());
        expect(producerProcessorCalls).toBeGreaterThan(0);
        expect(produced.scoringData).toBeDefined();
        expect(observed.text).toBe(produced.text);
        expect(observed.finishReason).toBe('stop');
        expect(observed.processorResolutions).toBe(1);
        expect(observed.processorCalls).toBe(0);
        expect(observed.resolvedTenantId).toBe('persisted-tenant');
        expect(observed.scoringDataDefined).toBe(true);
        expect(observed.scoringInputIncludesPrompt).toBe(true);
        expect(observed.scoringOutputIncludesAnswer).toBe(true);
      },
      CELL_TIMEOUT_MS,
    );

    it(
      'preserves an omitted returnScorerData option',
      async () => {
        const { observed, produced } = await runObserved();

        expect(produced.scoringData).toBeUndefined();
        expect(observed.scoringDataDefined).toBe(false);
        expect(observed.messagesIncludeAnswer).toBe(true);
      },
      CELL_TIMEOUT_MS,
    );

    // The observer reads the run's setup and transcript once on attach; each step's
    // response messages come from the stream.
    it(
      'reports the final answer when the run store fails after the observer attached',
      async () => {
        const { observed } = await runObserved(undefined, true);

        expect(observed.messagesIncludeAnswer).toBe(true);
        expect(observed.onFinishMessagesIncludeAnswer).toBe(true);
      },
      CELL_TIMEOUT_MS,
    );
  });
}

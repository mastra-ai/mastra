import { randomUUID } from 'node:crypto';

import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { getFreePort, makeStorageDir } from '../../test-fixtures/harness';
import { formatVerdict } from './compare';
import { checkCell } from './expected';
import { httpAbort, httpObserve } from './http-observe';
import { HarnessNode } from './node';
import type { NodeOptions } from './node';
import { normalise, withoutInterruptedText } from './normalise';
import { ABORT_ANSWER, SCENARIO_GROUPS, getScenario } from './scenarios';
import type { Scenario, ScenarioGroup } from './scenarios';
import { createProxy } from './toxiproxy';
import { ENGINES, LAYOUTS } from './types';
import type { Backend, Cell, Engine, Frame, RunCapture, Topology } from './types';

const AGENT_ID = 'harness-agent';
const RESOURCE = 'harness-user';
const skipRedis = process.env.SKIP_REDIS_TESTS === '1';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The processes a scenario runs on; `reader` is `publisher` in the single topology. */
interface Nodes {
  publisher: HarnessNode;
  reader: HarnessNode;
  /** The reader's HTTP port (server `/observe` and abort routes). */
  port: number;
  proxy?: Awaited<ReturnType<typeof createProxy>>;
}

async function subscribeThread(reader: HarnessNode, threadId: string) {
  const id = randomUUID();
  reader.send({ cmd: 'subscribeThread', id, threadId, resourceId: RESOURCE });
  await reader.next(e => e.type === 'subscribed' && e.id === id);
  return (waitForTerminalMs?: number) =>
    reader.frames({ cmd: 'stopThread', id, waitForTerminalMs }, 'thread', (waitForTerminalMs ?? 0) + 30_000);
}

function startStream(publisher: HarnessNode, scenario: Scenario, runId: string, threadId?: string, variant?: string) {
  const id = randomUUID();
  publisher.send({
    cmd: 'stream',
    id,
    scenario: scenario.name,
    variant,
    runId,
    threadId,
    resourceId: RESOURCE,
    timeoutMs: scenario.timeoutMs,
  });
  const live = publisher
    .next(e => e.type === 'frames' && e.id === id && e.reader === 'live', (scenario.timeoutMs ?? 45_000) + 5_000)
    .then(e => e.frames as Frame[]);
  const event = (type: string) => publisher.next(e => (e.type === type || e.type === 'stream-done') && e.id === id);
  return { id, live, event };
}

/**
 * Attaches `observe()` once the first step has started on the publisher, and
 * (durable, evented) once the run's snapshot is persisted, so the observer
 * sees the same run state on every run. The model's first token is 500ms out,
 * so the observer is attached before any text exists.
 */
async function observeMid(reader: HarnessNode, started: Promise<unknown>, runId: string, timeoutMs = 8_000) {
  await started;
  return reader.frames(
    { cmd: 'observe', runId, reader: 'observe-mid', afterPersisted: true, timeoutMs },
    'observe-mid',
    timeoutMs + 5_000,
  );
}

/** The readers that read a run after it ended: raw topic, `observe()` from 0, the `/observe` route. */
async function readBack({ reader, port }: Nodes, runId: string): Promise<RunCapture> {
  return {
    topic: await reader.frames({ cmd: 'tapTopic', runId }, 'topic'),
    'observe-0': await reader.frames({ cmd: 'observe', runId }, 'observe-0'),
    'http-observe': await httpObserve(port, AGENT_ID, runId),
  };
}

/**
 * How each flow drives a turn and what it captures. The publisher streams;
 * the reader process (the same process in the single topology) does all the
 * reading.
 */
const FLOWS: Record<NonNullable<Scenario['flow']>, (nodes: Nodes, scenario: Scenario) => Promise<RunCapture>> = {
  /** One turn, every reader. */
  async turn(nodes, scenario) {
    const runId = randomUUID();
    const stopThread = await subscribeThread(nodes.reader, `thread-${runId}`);
    const turn = startStream(nodes.publisher, scenario, runId, `thread-${runId}`);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId);
    const live = await turn.live;
    const observe = await mid;
    const capture: RunCapture = {
      live,
      'observe-mid': observe,
      ...(await readBack(nodes, runId)),
      thread: await stopThread(),
    };
    if (scenario.name === 'reasoning-flood') {
      const id = randomUUID();
      capture.broker = await nodes.reader.frames({ cmd: 'broker', id, runId }, 'broker');
      capture.retention = (
        await nodes.reader.next(e => e.type === 'frames' && e.id === id && e.reader === 'retention')
      ).frames;
      console.log(
        'RETENTION',
        JSON.stringify(nodes.reader.events.find(e => e.type === 'broker-inventory' && e.id === id)),
      );
    }
    return capture;
  },

  /**
   * The turn suspends on `lookup`'s approval; as soon as the caller sees the
   * approval request it calls `approveToolCall()`. Capture the original and
   * resume streams separately: durable keeps the original open and delivers
   * the resumed segment there too, so concatenating them duplicates output.
   */
  async approval(nodes, scenario) {
    const runId = randomUUID();
    const stopThread = await subscribeThread(nodes.reader, `thread-${runId}`);
    const turn = startStream(nodes.publisher, scenario, runId, `thread-${runId}`);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId, 15_000);
    const approval = await nodes.publisher.next(e => e.type === 'approval' && e.runId === runId);
    const resumed = await nodes.publisher.frames(
      { cmd: 'approve', runId, toolCallId: approval.toolCallId },
      'live-resume',
      45_000,
    );
    const first = await turn.live;
    const observe = await mid;
    return {
      live: first,
      'live-resume': resumed,
      'observe-mid': observe,
      ...(await readBack(nodes, runId)),
      thread: await stopThread(),
    };
  },

  /**
   * A first turn ends, then a second turn on another thread reuses its run ID
   * straight away, inside the first run's cleanup window. Every reader reads
   * the second turn.
   */
  async reuse(nodes, scenario) {
    const runId = randomUUID();
    await startStream(nodes.publisher, scenario, runId, `thread-first-${runId}`, 'first').live;
    const stopThread = await subscribeThread(nodes.reader, `thread-second-${runId}`);
    const second = startStream(nodes.publisher, scenario, runId, `thread-second-${runId}`, 'second');
    const mid = observeMid(nodes.reader, second.event('step-started'), runId);
    const live = await second.live;
    const observe = await mid;
    return { live, 'observe-mid': observe, ...(await readBack(nodes, runId)), thread: await stopThread() };
  },

  /**
   * An observer in the reader process (1s cleanup) watches the whole run;
   * 2.5s after it ends, well inside the publisher's own cleanup window, the
   * publisher replays the run from 0 and reads its topic. If the observer's
   * shorter cleanup deleted the run's log, those come back empty.
   */
  async 'observer-cleanup'(nodes, scenario) {
    const runId = randomUUID();
    const turn = startStream(nodes.publisher, scenario, runId);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId);
    const live = await turn.live;
    const observe = await mid;
    await sleep(2_500);
    return {
      live,
      'observe-mid': observe,
      'observe-0': await nodes.publisher.frames({ cmd: 'observe', runId, reader: 'observe-0' }, 'observe-0'),
      topic: await nodes.publisher.frames({ cmd: 'tapTopic', runId, timeoutMs: 2_000 }, 'topic'),
    };
  },

  /** 800ms into the text, the reader aborts the run through the server's abort route. */
  async abort(nodes, scenario) {
    const runId = randomUUID();
    const stopThread = await subscribeThread(nodes.reader, `thread-${runId}`);
    const turn = startStream(nodes.publisher, scenario, runId, `thread-${runId}`);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId);
    await turn.event('text-started');
    await sleep(800);
    let acknowledgement: RunCapture;
    if (scenario.name === 'direct-abort') {
      expect(nodes.publisher.events.some(e => e.type === 'stream-done' && e.id === turn.id)).toBe(false);
      const unknownId = randomUUID();
      nodes.reader.send({ cmd: 'abort', id: unknownId, runId: randomUUID() });
      const unknown = await nodes.reader.next(e => e.type === 'aborted' && e.id === unknownId);
      const abortId = randomUUID();
      nodes.reader.send({ cmd: 'abort', id: abortId, runId });
      const result = await nodes.reader.next(e => e.type === 'aborted' && e.id === abortId);
      acknowledgement = {
        'abort-result': [{ type: 'abort-result', shape: `returned=${result.result} unknown=${unknown.result}` }],
      };
    } else {
      acknowledgement = { ack: await httpAbort(nodes.port, AGENT_ID, runId) };
    }
    const live = await turn.live;
    const observe = await mid;
    return {
      live,
      'observe-mid': observe,
      ...(await readBack(nodes, runId)),
      thread: await stopThread(),
      ...acknowledgement,
    };
  },

  /** As `abort`, for a run started with `generate()`; 1.3s after the call (0.8s into the text). */
  async 'generate-abort'(nodes, scenario) {
    const runId = randomUUID();
    const id = randomUUID();
    const generate = nodes.publisher.frames(
      {
        cmd: 'generate',
        id,
        scenario: scenario.name,
        runId,
        checkCallback: scenario.name === 'generate-partial-abort',
      },
      'generate',
      45_000,
    );
    if (scenario.name === 'generate-partial-abort' && nodes.publisher.opts.engine !== 'plain') {
      await nodes.publisher.next(e => e.type === 'generate-text-started' && e.id === id);
    } else {
      await sleep(1_300);
    }
    expect(
      nodes.publisher.events.some(e => e.type === 'frames' && e.id === id && e.reader === 'generate'),
      'generate completed before abort; fixture timing did not keep the request in flight',
    ).toBe(false);
    const ack = await httpAbort(nodes.port, AGENT_ID, runId);
    return { ack, generate: await generate };
  },

  async 'resume-generate-abort'(nodes, scenario) {
    const runId = randomUUID();
    const id = randomUUID();
    const generate = nodes.publisher.frames(
      { cmd: 'generate', id, scenario: scenario.name, runId, resume: true },
      'generate',
      45_000,
    );
    await nodes.publisher.next(e => e.type === 'resume-started' && e.id === id);
    if (nodes.publisher.opts.engine === 'plain') {
      // Plain generate uses a non-streaming provider request; no partial tokens are exposed.
      await sleep(1_300);
    } else {
      await nodes.publisher.next(e => e.type === 'generate-text-started' && e.id === id);
    }
    expect(
      nodes.publisher.events.some(e => e.type === 'frames' && e.id === id && e.reader === 'generate'),
      'resumeGenerate completed before abort',
    ).toBe(false);
    const ack = await httpAbort(nodes.port, AGENT_ID, runId);
    const result = await generate;
    if (process.env.STREAM_HARNESS_VERBOSE) {
      console.log(
        'resume abort output',
        nodes.publisher.events.filter(e => e.type === 'abort-output' && e.id === id),
      );
    }
    return { ack, generate: result };
  },

  async 'transport-fault'(nodes, scenario) {
    if (!nodes.proxy || !scenario.fault) throw new Error('transport fault requires a proxy and a fault');
    const runId = randomUUID();
    const stopThread = await subscribeThread(nodes.reader, `thread-${runId}`);
    const turn = startStream(nodes.publisher, scenario, runId, `thread-${runId}`);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId, scenario.timeoutMs);
    // Observe both failures immediately, including those that arrive during the outage.
    const completed = Promise.allSettled([turn.live, mid]);
    const firstText = await nodes.reader.next(e => e.type === 'observer-text' && e.runId === runId);
    const began = Date.now();
    console.log(
      'FAULT-START',
      JSON.stringify({
        scenario: scenario.name,
        engine: nodes.publisher.opts.engine,
        backend: nodes.publisher.opts.backend,
        split: nodes.publisher !== nodes.reader,
        runId,
        firstText,
      }),
    );
    await nodes.proxy.inject(scenario.fault.kind);
    try {
      await sleep(scenario.fault.durationMs);
    } finally {
      await nodes.proxy.recover();
    }
    console.log('FAULT', JSON.stringify({ scenario: scenario.name, outageMs: Date.now() - began }));
    const [liveResult, observeResult] = await completed;
    if (process.env.STREAM_HARNESS_VERBOSE) console.log('PUBLISHER-STDERR', JSON.stringify(nodes.publisher.stderr));
    console.log(
      'FAULT-END',
      JSON.stringify({
        scenario: scenario.name,
        recoveryMs: Date.now() - began - scenario.fault.durationMs,
        live: liveResult.status,
        observer: observeResult.status,
      }),
    );
    console.log(
      'OBSERVER-TIMELINE',
      JSON.stringify(nodes.reader.events.filter(e => e.type === 'observer-text' && e.runId === runId)),
    );
    if (liveResult.status === 'rejected') throw liveResult.reason;
    if (observeResult.status === 'rejected') throw observeResult.reason;
    return {
      live: liveResult.value,
      'observe-mid': observeResult.value,
      ...(await readBack(nodes, runId)),
      thread: await stopThread(35_000),
    };
  },
  async 'publisher-death'(nodes, scenario) {
    const runId = randomUUID();
    const stopThread = await subscribeThread(nodes.reader, `thread-${runId}`);
    const turn = startStream(nodes.publisher, scenario, runId, `thread-${runId}`);
    // The caller process will die, so its normal stream-completed report cannot arrive.
    const killedCaller = turn.live.catch(() => undefined);
    const mid = observeMid(nodes.reader, turn.event('step-started'), runId);
    await nodes.reader.next(e => e.type === 'observer-text' && e.runId === runId);
    expect(
      nodes.publisher.events.some(e => e.type === 'stream-done' && e.id === turn.id),
      'publisher must still be running when killed',
    ).toBe(false);
    const killedAt = Date.now();
    await nodes.publisher.kill();
    await killedCaller;
    const live = normalise(
      nodes.publisher.events.filter(e => e.type === 'live-chunk' && e.id === turn.id).map(e => e.chunk),
    );
    expect(
      live.some(f => f.type === 'finish'),
      'SIGKILL must interrupt a live run, not a finished one',
    ).toBe(false);
    live.push({ type: '(killed)' });
    const observe = await mid;
    const replay = await readBack(nodes, runId);
    // A check just before lease expiry can defer failure until the next 15s check.
    const thread = await stopThread(35_000);
    const status = await nodes.reader.frames({ cmd: 'runStatus', runId }, 'run-status');
    console.log(
      'PUBLISHER-DEATH',
      JSON.stringify({
        engine: nodes.publisher.opts.engine,
        backend: nodes.publisher.opts.backend,
        runId,
        waitedAfterKillMs: Date.now() - killedAt,
        observer: nodes.reader.events.find(e => e.type === 'observer-ended'),
        status,
        storedStatus: nodes.reader.events.find(e => e.type === 'run-status-detail' && e.runId === runId),
      }),
    );
    return {
      live,
      'observe-mid': observe,
      ...replay,
      thread,
      'run-status': status,
    };
  },
  async 'key-cleanup'(nodes, scenario) {
    const runId = randomUUID();
    const threadId = `thread-${runId}`;
    const live = await startStream(nodes.publisher, scenario, runId, threadId).live;
    await sleep(4_000);
    return { live, keys: await nodes.reader.frames({ cmd: 'scanKeys', runId, threadId }, 'keys') };
  },
};

async function startNodes(
  topology: Topology,
  common: Omit<NodeOptions, 'nodeId' | 'cleanupMs' | 'port'>,
  cleanup: Scenario['nodes'] = {},
): Promise<Nodes> {
  const port = await getFreePort();
  if (topology === 'single') {
    const node = await HarnessNode.start({
      ...common,
      maxStreamLength: cleanup.maxStreamLength,
      port,
      cleanupMs: cleanup.readerCleanupMs ?? cleanup.cleanupMs,
    });
    return { publisher: node, reader: node, port };
  }
  const started = await Promise.allSettled([
    HarnessNode.start({
      ...common,
      maxStreamLength: cleanup.maxStreamLength,
      nodeId: 'publisher',
      cleanupMs: cleanup.cleanupMs,
    }),
    HarnessNode.start({
      ...common,
      busUrl: undefined,
      maxStreamLength: cleanup.maxStreamLength,
      nodeId: 'reader',
      port,
      cleanupMs: cleanup.readerCleanupMs,
    }),
  ]);
  const failure = started.find(result => result.status === 'rejected');
  if (failure) {
    await Promise.all(started.map(result => (result.status === 'fulfilled' ? result.value.stop() : undefined)));
    throw failure.reason;
  }
  const [publisher, reader] = started.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  return { publisher: publisher!, reader: reader!, port };
}

const stopNodes = async (nodes?: Nodes) => {
  const results = await Promise.allSettled([nodes?.publisher.stop(), nodes?.reader.stop()]);
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Failed to stop harness nodes');
};

/**
 * Runs each scenario of a group on every engine, backend and topology,
 * captures every reader and fails on any difference not listed in
 * `known-differences.ts`, or on any listed difference that no longer
 * reproduces. A scenario with its own `nodes` settings runs on fresh
 * processes; the rest share one set per engine and layout.
 */
export function defineGrid(group: ScenarioGroup) {
  const scenarios = SCENARIO_GROUPS[group];
  describe.skipIf(skipRedis)(`stream harness grid: ${group}`, () => {
    let llm: LLMock;
    let llmUrl: string;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
      llmUrl = llm.url.replace(/\/+$/, '');
      for (const name of scenarios) getScenario(name).script(llm);
    });

    afterAll(async () => {
      await llm?.stop();
    });

    describe.each(
      LAYOUTS.filter(layout =>
        scenarios.some(name => {
          const layouts = getScenario(name).layouts;
          return !layouts || layouts.includes(`${layout.topology}/${layout.backend}`);
        }),
      ),
    )('$topology / $backend', ({ topology, backend }) => {
      const plain = new Map<string, RunCapture>();

      describe.each(ENGINES)('%s', engine => {
        let storage: Awaited<ReturnType<typeof makeStorageDir>>;
        let shared: Nodes | undefined;
        const common = (engine: Engine, backend: Backend) => ({
          engine,
          backend,
          llmUrl,
          keyPrefix: `stream-harness-${randomUUID()}`,
          storageUrl: storage.storageUrl,
        });

        beforeAll(async () => {
          storage = await makeStorageDir('stream-harness-');
        });

        afterAll(async () => {
          await stopNodes(shared);
          await storage?.cleanup();
        });

        const applicable = scenarios.filter(name => {
          const layouts = getScenario(name).layouts;
          return !layouts || layouts.includes(`${topology}/${backend}`);
        });
        it.each(applicable)(
          '%s',
          async name => {
            const scenario = getScenario(name);
            const cell: Cell = { scenario: name, engine, backend, topology };
            let own: Nodes | undefined;
            let capture: RunCapture;
            let proxy: Awaited<ReturnType<typeof createProxy>> | undefined;
            let cleanupPromise: Promise<PromiseSettledResult<unknown>[]> | undefined;
            const cleanup = () => (cleanupPromise ??= Promise.allSettled([stopNodes(own), proxy?.close()]));
            onTestFinished(async () => {
              const results = await cleanup();
              const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
              if (errors.length) throw new AggregateError(errors, 'Failed to clean up harness cell');
            });
            try {
              if (scenario.fault || scenario.name === 'transport-control') {
                if (backend === 'memory') throw new Error('transport fault needs a real backend');
                proxy = await createProxy(backend);
              }
              if (scenario.nodes) {
                own = await startNodes(topology, { ...common(engine, backend), busUrl: proxy?.url }, scenario.nodes);
                own.proxy = proxy;
              } else {
                shared ??= await startNodes(topology, common(engine, backend));
              }
              capture = await FLOWS[scenario.flow ?? 'turn'](own ?? shared!, scenario);
            } finally {
              await cleanup();
            }
            if (process.env.STREAM_HARNESS_VERBOSE) console.log('RAW-CAPTURE', JSON.stringify({ cell, capture }));
            if (scenario.ignoreText) capture = withoutInterruptedText(capture, ABORT_ANSWER);
            if (engine === 'plain') plain.set(name, capture);
            if (process.env.STREAM_HARNESS_VERBOSE) console.log('CAPTURE', JSON.stringify({ cell, capture }));

            const { verdict, drift: drifted, symptoms, rawDifferences } = checkCell(cell, capture, plain.get(name));
            if (symptoms) console.log('PINNED-SYMPTOMS', JSON.stringify({ cell, symptoms, rawDifferences }));
            const drift = drifted.map(d => `  DRIFT ${d.reader} [${d.kind}] ${d.detail}`);
            const report = [formatVerdict(cell, verdict), ...drift].join('\n');
            if (process.env.STREAM_HARNESS_VERBOSE) console.log(`${report}\n${JSON.stringify(capture)}`);
            expect(verdict.unlisted.length + verdict.stale.length + drift.length, report).toBe(0);
          },
          // Covers startup, the 100s observer, sequential readback, the 35s thread wait, and cleanup.
          group === 'faults' ? 300_000 : 60_000,
        );
      });
    });
  });
}

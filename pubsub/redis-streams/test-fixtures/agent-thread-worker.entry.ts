/**
 * Fixture worker that simulates a single Vercel-Lambda-like process holding
 * one AgentThreadStreamRuntime + Agent bound to a shared RedisStreamsPubSub.
 *
 * The worker reads newline-delimited JSON commands on stdin and emits
 * newline-delimited JSON events on stdout. Commands:
 *   {"cmd":"send","sigId":"s1","text":"hello","runMs":300}
 *   {"cmd":"exit"}
 *
 * Events:
 *   {"type":"ready"}
 *   {"type":"signal-result","sigId":"s1","accepted":true}
 *   {"type":"run-started","sigId":"s1","runId":"..."}
 *   {"type":"run-finished","sigId":"s1","runId":"..."}
 *   {"type":"run-error","sigId":"s1","error":"..."}
 *
 * The "runMs" field controls how long the stubbed agent.stream() takes to
 * resolve _waitUntilFinished, simulating an in-flight model call.
 */
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

import type { Agent } from '@mastra/core/agent';
// These helpers aren't part of the public test surface; this fixture reaches
// into workspace source so the child process exercises the real implementations.
import { convertMastraChunkToAISDKBase } from '../../../client-sdks/ai-sdk/src/helpers';
import { AgentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';

import { RedisStreamsPubSub } from '../src/index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const RESOURCE_ID = process.env.RESOURCE_ID ?? 'rapid-fire-resource';
const THREAD_ID = process.env.THREAD_ID ?? 'rapid-fire-thread';
const WORKER_ID = process.env.WORKER_ID ?? 'worker';
const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

function threadTopic() {
  const key = `${RESOURCE_ID}${AGENT_THREAD_KEY_SEPARATOR}${THREAD_ID}`;
  return `agent.thread-stream.${encodeURIComponent(key)}`;
}

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

/**
 * Map sigId -> resolver so the worker can correlate the inbound stub stream
 * completion with the SEND command that started it. The stub agent buries the
 * sigId inside the message contents and we read it back from the call.
 */
const runEnds = new Map<string, () => void>();

function makeStubAgent(runMs: number, runtime: AgentThreadStreamRuntime, pubsub: RedisStreamsPubSub) {
  const agent: any = {
    id: `${WORKER_ID}-agent`,
    name: `${WORKER_ID} Stub Agent`,
    getMemory: async () => ({ saveMessages: async () => {} }),
    stream: async (input: any, options: any) => {
      // The signal carrying the user message exposes its sigId as contents.
      const sigId: string = typeof input === 'string' ? input : (input?.contents ?? input?.text ?? '');
      const runId = options?.runId ?? randomUUID();
      const finished = new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          runEnds.delete(sigId);
          resolve();
        }, runMs);
        timer.unref();
        runEnds.set(sigId, () => {
          clearTimeout(timer);
          runEnds.delete(sigId);
          resolve();
        });
      });

      emit({ type: 'run-started', sigId, runId });

      void finished.then(() => {
        emit({ type: 'run-finished', sigId, runId });
      });

      const output: any = {
        runId,
        status: 'running',
        fullStream: (async function* () {})(),
        consumeStream: async () => {},
        _waitUntilFinished: () => finished,
      };

      // Real Agent.stream prepares the abort controller before registering the
      // run. Mirror that boundary so follower abort requests reach a real owner.
      const preparedOptions = runtime.prepareRunOptions(
        {
          ...(options ?? {}),
          runId,
          memory: { resource: RESOURCE_ID, thread: THREAD_ID },
        } as any,
        pubsub,
      );
      preparedOptions.abortSignal?.addEventListener(
        'abort',
        () => {
          emit({ type: 'owner-abort-fired', sigId, runId });
          runEnds.get(sigId)?.();
        },
        { once: true },
      );

      // Real Agent.stream registers the run with the runtime so completion
      // watchers fire and pending signals drain. The stub mirrors that.
      void runtime.registerRun(agent as any, output as any, preparedOptions as any, pubsub);

      return output;
    },
  };
  return agent as Agent;
}

async function collectRun(subscription: any, convert: boolean) {
  const parts: unknown[] = [];
  const iterator = subscription.stream[Symbol.asyncIterator]();
  while (true) {
    const next = await iterator.next();
    if (next.done) throw new Error('subscription ended before a terminal part');
    const part = next.value as any;
    parts.push(
      convert
        ? convertMastraChunkToAISDKBase({
            chunk: part,
            normalizeWarnings: warnings => warnings ?? [],
            normalizeUsage: usage => usage,
            normalizeFinishReason: reason => reason,
          })
        : part,
    );
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') return parts;
  }
}

async function main() {
  const pubsub = new RedisStreamsPubSub({ url: REDIS_URL });
  const runtime = new AgentThreadStreamRuntime();
  // runMs is fixed per worker (set at boot via env) so the test can vary
  // "slow worker A" vs "fast follower workers B/C" without per-send wiring.
  const runMs = Number(process.env.RUN_MS ?? '300');
  const agent = makeStubAgent(runMs, runtime, pubsub);

  // Keep a thread subscription open so this worker receives signal-enqueued
  // events from other workers and updates its local activeThreadRunIds map.
  const defaultSubscription = await runtime.subscribeToThread(
    agent as any,
    { resourceId: RESOURCE_ID, threadId: THREAD_ID },
    pubsub,
  );

  emit({ type: 'ready' });

  // Fire a single signal. Returns a promise that resolves once `accepted`
  // settles, emitting `owner-stream-resolved` with whether this process became
  // the lease winner (action === 'wake' with a real owner stream).
  function fireSignal(sigId: string): Promise<void> {
    const result = runtime.sendSignal(
      agent as any,
      { type: 'user-message', contents: sigId },
      {
        resourceId: RESOURCE_ID,
        threadId: THREAD_ID,
        ifIdle: {
          behavior: 'wake' as const,
          streamOptions: {
            memory: { resource: RESOURCE_ID, thread: THREAD_ID },
          },
        },
        ifActive: {
          behavior: 'deliver' as const,
        },
      },
      pubsub,
    );
    emit({ type: 'signal-result', sigId, accepted: true });
    return result.accepted
      .then(settled => {
        emit({
          type: 'owner-stream-resolved',
          sigId,
          defined: settled.action === 'wake' && Boolean(settled.output),
        });
      })
      .catch(err => {
        emit({ type: 'owner-stream-error', sigId, error: String(err) });
      });
  }

  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line: string) => {
    if (!line.trim()) return;
    let cmd: any;
    try {
      cmd = JSON.parse(line);
    } catch (err) {
      emit({ type: 'parse-error', line, error: String(err) });
      return;
    }

    if (cmd.cmd === 'exit') {
      defaultSubscription.unsubscribe();
      try {
        await pubsub.close();
      } catch {}
      process.exit(0);
    }

    if (cmd.cmd === 'persist') {
      try {
        const result = runtime.sendSignal(
          agent as any,
          { type: 'user-message', contents: cmd.text ?? 'persisted signal' },
          {
            resourceId: RESOURCE_ID,
            threadId: THREAD_ID,
            ifIdle: { behavior: 'persist' as const },
          },
          pubsub,
        );
        const accepted = await result.accepted;
        await result.persisted;
        await pubsub.flush();
        emit({ type: 'persisted', runId: 'runId' in accepted ? accepted.runId : undefined });
      } catch (err) {
        emit({ type: 'command-error', cmd: cmd.cmd, error: String(err) });
      }
      return;
    }

    if (cmd.cmd === 'collect-default' || cmd.cmd === 'collect-fresh') {
      const fresh = cmd.cmd === 'collect-fresh';
      const subscription = fresh
        ? await runtime.subscribeToThread(agent as any, { resourceId: RESOURCE_ID, threadId: THREAD_ID }, pubsub)
        : defaultSubscription;
      if (fresh) emit({ type: 'fresh-subscription-created' });
      try {
        const parts = await collectRun(subscription, cmd.mode === 'converted');
        emit({ type: 'subscription-result', source: fresh ? 'fresh' : 'default', parts });
      } catch (err) {
        emit({ type: 'command-error', cmd: cmd.cmd, error: String(err) });
      } finally {
        if (fresh) subscription.unsubscribe();
      }
      return;
    }

    if (cmd.cmd === 'publish-ghost') {
      const runId = cmd.runId ?? 'ghost-run';
      const streamId = cmd.streamId ?? 'ghost-stream';
      await pubsub.publish(threadTopic(), {
        type: 'run-registered',
        runId,
        data: { type: 'run-registered', runId, streamId, streamSeq: 1 },
      });
      await pubsub.flush();
      emit({ type: 'ghost-published', runId, streamId });
      return;
    }

    if (cmd.cmd === 'send-after-thread-wait') {
      try {
        await runtime.waitForCrossAgentThreadRun(
          agent as any,
          { memory: { resource: RESOURCE_ID, thread: THREAD_ID } },
          pubsub,
        );
        emit({ type: 'thread-wait-resolved' });
        await fireSignal(cmd.sigId);
      } catch (err) {
        emit({ type: 'command-error', cmd: cmd.cmd, error: String(err) });
      }
      return;
    }

    if (cmd.cmd === 'abort-active') {
      const runId = defaultSubscription.activeRunId();
      emit({ type: 'abort-result', runId, aborted: defaultSubscription.abort() });
      return;
    }

    if (cmd.cmd === 'active-run') {
      emit({ type: 'active-run', runId: defaultSubscription.activeRunId() });
      return;
    }

    if (cmd.cmd === 'send' || cmd.cmd === 'send-and-exit') {
      const sigId: string = cmd.sigId;
      try {
        const ownerSettled = fireSignal(sigId);

        if (cmd.cmd === 'send-and-exit') {
          // Models a Vercel Lambda that waitUntil-defers the publish, then dies.
          // Make sure the lease loser path (which fires `signal-enqueued`) has
          // actually flushed to Redis before we shut down.
          await ownerSettled;
          try {
            await pubsub.close();
          } catch {}
          process.exit(0);
        }
      } catch (err) {
        emit({ type: 'run-error', sigId, error: String(err) });
      }
    }

    if (cmd.cmd === 'send-idle-poll') {
      // Repeatedly fire idle-wake signals to probe for any window where the
      // thread lease is momentarily free. A correct runtime keeps the lease
      // owned for as long as queued follow-up work is draining, so every probe
      // must lose the lease (action 'deliver'). If the runtime releases the
      // lease before re-acquiring for a drained run, one of these probes will
      // win the freed lease and start a competing run for the same thread —
      // exposing the cross-process race.
      const count: number = cmd.count ?? 40;
      const intervalMs: number = cmd.intervalMs ?? 25;
      const prefix: string = cmd.sigPrefix ?? 'probe';
      for (let i = 0; i < count; i++) {
        void fireSignal(`${prefix}-${i}`);
        await new Promise(r => setTimeout(r, intervalMs));
      }
      emit({ type: 'idle-poll-done', count });
    }
  });
}

main().catch(err => {
  emit({ type: 'fatal', error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});

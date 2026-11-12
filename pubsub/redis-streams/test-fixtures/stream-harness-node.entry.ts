/**
 * One Mastra process of the stream harness (`src/stream-harness`). It hosts a
 * single agent on the engine named by ENGINE and the backend named by
 * BACKEND, and reports what each reader of a run received, reduced with
 * `normalise()` before it leaves the process (an `Error` does not survive
 * JSON, so the shape is taken here, where the reader got the chunk).
 *
 * Env:
 *   ENGINE      plain | durable | evented (evented is constructed directly so CLEANUP_MS applies)
 *   BACKEND     memory | redis | valkey
 *   REDIS_URL, VALKEY_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, NODE_ID
 *   CLEANUP_MS  stream cleanupTimeoutMs (engine default when unset)
 *   PORT        when set, also serves the Mastra HTTP API (for the /observe route)
 *
 * Reads newline-delimited JSON commands on stdin, writes newline-delimited
 * JSON events on stdout:
 *   {"cmd":"stream","id","scenario","runId","threadId?","resourceId?"} -> run, step-started, approval*, frames(live), stream-done
 *   {"cmd":"observe","id","runId","reader?","offset?","timeoutMs?","afterPersisted?"} -> frames(observe-0 | observe-mid)
 *   {"cmd":"tapTopic","id","runId"}                                   -> frames(topic)
 *   {"cmd":"subscribeThread","id","threadId","resourceId"}            -> subscribed
 *   {"cmd":"stopThread","id"}                                         -> frames(thread)
 *   {"cmd":"approve","id","runId","toolCallId"}                       -> frames(live-resume)
 *   {"cmd":"abort","id","runId"}                                      -> aborted
 *   {"cmd":"exit"}
 */
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { DurableAgent, EventedAgent } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import type { PubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createNodeServer } from '@mastra/deployer/server';
import { LibSQLStore } from '@mastra/libsql';
import { ValkeyServerCache } from '@mastra/valkey';
import { ValkeyStreamsPubSub } from '@mastra/valkey-streams';
import { createClient } from 'redis';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';
import { fromChunk, fromTopicEvent, normalise } from '../src/stream-harness/normalise';
import type { RawFrame } from '../src/stream-harness/normalise';
import { getScenario } from '../src/stream-harness/scenarios';

const {
  ENGINE = 'plain',
  BACKEND = 'memory',
  REDIS_URL,
  VALKEY_URL = 'valkey://localhost:6383',
  KEY_PREFIX = 'stream-harness',
  STORAGE_URL,
  LLM_URL,
  NODE_ID = 'node',
  CLEANUP_MS,
  PORT,
} = process.env;

/** Valkey Glide is a dependency of @mastra/valkey, not of this package. */
async function glideClient(url: string): Promise<any> {
  const { GlideClient } = createRequire(import.meta.resolve('@mastra/valkey'))('@valkey/valkey-glide');
  const { hostname, port } = new URL(url);
  return GlideClient.createClient({ addresses: [{ host: hostname, port: Number(port) }] });
}

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ node: NODE_ID, ...event })}\n`);
}

const tools = {
  boom: createTool({
    id: 'boom',
    description: 'Always throws.',
    inputSchema: z.object({}),
    execute: async () => {
      throw new Error('kaboom');
    },
  }),
  nothing: createTool({
    id: 'nothing',
    description: 'Returns nothing.',
    inputSchema: z.object({}),
    execute: async () => undefined,
  }),
  lookup: createTool({
    id: 'lookup',
    description: 'Looks up a value; needs approval.',
    inputSchema: z.object({ query: z.string() }),
    requireApproval: true,
    execute: async ({ query }) => ({ value: `found:${query}` }),
  }),
};

/** Blocks the turn before the model is called when the prompt asks for it. */
const tripwire = {
  id: 'harness-tripwire',
  processInput: async ({ messages, abort }: any) => {
    if (JSON.stringify(messages).includes('TRIPWIRE')) abort('blocked by harness');
    return messages;
  },
};

const TERMINAL = new Set(['finish', 'error', 'tripwire', 'abort', 'suspended']);

async function drain(iterable: AsyncIterable<any>, timeoutMs: number, onChunk?: (chunk: any) => void) {
  const raw: RawFrame[] = [];
  let timer: NodeJS.Timeout | undefined;
  const timedOut = await Promise.race([
    (async () => {
      try {
        for await (const chunk of iterable) {
          raw.push(fromChunk(chunk));
          onChunk?.(chunk);
        }
      } catch (error) {
        raw.push({ type: '(threw)', payload: { error } });
      }
      return false;
    })(),
    new Promise<boolean>(resolve => (timer = setTimeout(() => resolve(true), timeoutMs))),
  ]);
  clearTimeout(timer);
  if (timedOut) raw.push({ type: '(timeout)' });
  return raw;
}

async function main() {
  let transport: PubSub;
  let cache: InMemoryServerCache | RedisServerCache | ValkeyServerCache;
  let tapCache: InMemoryServerCache | RedisServerCache | ValkeyServerCache;
  const clients: { quit: () => Promise<unknown> }[] = [];
  if (BACKEND === 'memory') {
    transport = new EventEmitterPubSub();
    cache = new InMemoryServerCache();
    tapCache = cache;
  } else if (BACKEND === 'redis') {
    const cacheClient = createClient({ url: REDIS_URL });
    const tapClient = createClient({ url: REDIS_URL });
    await Promise.all([cacheClient.connect(), tapClient.connect()]);
    clients.push(cacheClient, tapClient);
    transport = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: KEY_PREFIX, blockMs: 200 });
    const preset = { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache` };
    cache = new RedisServerCache({ client: cacheClient as any }, preset);
    // A separate connection, so the topic reader reads what reached Redis.
    tapCache = new RedisServerCache({ client: tapClient as any }, preset);
  } else if (BACKEND === 'valkey') {
    const [cacheClient, tapClient] = await Promise.all([glideClient(VALKEY_URL), glideClient(VALKEY_URL)]);
    clients.push({ quit: async () => cacheClient.close() }, { quit: async () => tapClient.close() });
    transport = new ValkeyStreamsPubSub({ url: VALKEY_URL, keyPrefix: KEY_PREFIX, blockMs: 200 });
    cache = new ValkeyServerCache({ client: cacheClient }, { keyPrefix: `${KEY_PREFIX}:cache:` });
    tapCache = new ValkeyServerCache({ client: tapClient }, { keyPrefix: `${KEY_PREFIX}:cache:` });
  } else {
    throw new Error(`unsupported BACKEND ${BACKEND}`);
  }
  // Reads the run topic's replay log; only getHistory is used.
  const tap = new CachingPubSub(new EventEmitterPubSub(), tapCache);

  const cleanupTimeoutMs = CLEANUP_MS ? Number(CLEANUP_MS) : undefined;
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${LLM_URL}/v1` });
  const base = new Agent({
    id: 'harness-agent',
    name: 'Harness Agent',
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai('gpt-4o-mini'),
    tools,
    inputProcessors: [tripwire],
    ...(ENGINE === 'plain' && cleanupTimeoutMs !== undefined ? { durable: { cleanupTimeoutMs } } : {}),
  });
  const agent =
    ENGINE === 'plain'
      ? base
      : ENGINE === 'durable'
        ? new DurableAgent({ agent: base, cleanupTimeoutMs })
        : new EventedAgent({ agent: base, cleanupTimeoutMs });

  const mastra = new Mastra({
    logger: false,
    storage: new LibSQLStore({ id: 'stream-harness-storage', url: STORAGE_URL! }),
    pubsub: transport,
    cache,
    agents: { 'harness-agent': agent as any },
    ...(PORT ? { server: { port: Number(PORT) } } : {}),
  });
  const registered: any = mastra.getAgent('harness-agent' as any);

  const threads = new Map<string, { raw: RawFrame[]; unsubscribe: () => void; done: Promise<void> }>();

  const frames = (id: string, reader: string, raw: RawFrame[]) =>
    emit({ type: 'frames', id, reader, frames: normalise(raw) });

  const onLiveChunk = (id: string, runId: string) => {
    let stepStarted = false;
    return (chunk: any) => {
      if (chunk.type === 'step-start' && !stepStarted) {
        stepStarted = true;
        emit({ type: 'step-started', id, runId });
      }
      if (chunk.type === 'tool-call-approval') emit({ type: 'approval', runId, toolCallId: chunk.payload?.toolCallId });
    };
  };

  // A durable/evented observer in another process recovers the run's options
  // (structured output schema, request context) from the persisted workflow
  // snapshot. Attaching before that row carries the run input loses them on
  // some runs and not others, so the mid-run observer waits for it.
  const waitForPersistedRun = async (runId: string) => {
    const workflows = await mastra.getStorage()?.getStore('workflows');
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      for (const workflowName of ['durable-agentic-loop', 'durable-agentic-execution']) {
        const row: any = await workflows?.getWorkflowRunById({ runId, workflowName });
        const snapshot = typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
        if (snapshot?.context?.input?.__workflowKind === 'durable-agent') return;
      }
      await new Promise(r => setTimeout(r, 25));
    }
  };

  const handlers: Record<string, (cmd: any) => Promise<void> | void> = {
    async stream(cmd) {
      const scenario = getScenario(cmd.scenario);
      const out = await registered.stream(scenario.prompt, {
        runId: cmd.runId,
        maxSteps: 5,
        ...(cmd.threadId ? { memory: { thread: cmd.threadId, resource: cmd.resourceId } } : {}),
        ...scenario.streamOptions?.(),
      });
      emit({ type: 'run', id: cmd.id, runId: out.runId });
      frames(cmd.id, 'live', await drain(out.fullStream, cmd.timeoutMs ?? 20_000, onLiveChunk(cmd.id, out.runId)));
      emit({ type: 'stream-done', id: cmd.id, runId: out.runId });
    },
    async observe(cmd) {
      if (cmd.afterPersisted && ENGINE !== 'plain') await waitForPersistedRun(cmd.runId);
      const observation = await registered.observe(cmd.runId, cmd.offset === undefined ? {} : { offset: cmd.offset });
      const raw = await drain(observation.fullStream, cmd.timeoutMs ?? 5_000);
      observation.detach?.();
      frames(cmd.id, cmd.reader ?? 'observe-0', raw);
    },
    async tapTopic(cmd) {
      // Plain copies frames to the topic in the background, so the log can
      // trail the caller's stream; wait for a terminal frame, then for the log
      // to stop growing (a terminal chunk such as `tripwire` can be followed
      // by run-level events).
      const deadline = Date.now() + (cmd.timeoutMs ?? 5_000);
      let raw: RawFrame[] = [];
      let settledAt = Date.now();
      while (true) {
        const next = (await tap.getHistory(`agent.stream.${cmd.runId}`, 0)).map(fromTopicEvent);
        if (next.length !== raw.length) settledAt = Date.now();
        raw = next;
        const terminal = TERMINAL.has(raw[raw.length - 1]?.type ?? '');
        if ((terminal && Date.now() - settledAt >= 300) || Date.now() > deadline) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      frames(cmd.id, 'topic', raw);
    },
    async subscribeThread(cmd) {
      const subscription = await registered.subscribeToThread({ threadId: cmd.threadId, resourceId: cmd.resourceId });
      const raw: RawFrame[] = [];
      const done = (async () => {
        try {
          for await (const chunk of subscription.stream) raw.push(fromChunk(chunk));
        } catch (error) {
          raw.push({ type: '(threw)', payload: { error } });
        }
      })();
      threads.set(cmd.id, { raw, unsubscribe: () => subscription.unsubscribe(), done });
      emit({ type: 'subscribed', id: cmd.id });
    },
    async stopThread(cmd) {
      const thread = threads.get(cmd.id);
      if (!thread) throw new Error(`no thread subscription ${cmd.id}`);
      thread.unsubscribe();
      await Promise.race([thread.done, new Promise(resolve => setTimeout(resolve, 1_000))]);
      threads.delete(cmd.id);
      frames(cmd.id, 'thread', thread.raw);
    },
    async approve(cmd) {
      const resumed = await registered.approveToolCall({ runId: cmd.runId, toolCallId: cmd.toolCallId });
      frames(cmd.id, 'live-resume', await drain(resumed.fullStream, cmd.timeoutMs ?? 20_000));
    },
    abort(cmd) {
      emit({ type: 'aborted', id: cmd.id, result: registered.abortRunStream(cmd.runId) });
    },
    exit: () => shutdown(),
  };

  async function shutdown() {
    for (const thread of threads.values()) thread.unsubscribe();
    (server as any)?.close?.();
    await mastra.shutdown?.().catch(() => {});
    await Promise.all(clients.map(client => client.quit().catch(() => {})));
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  createInterface({ input: process.stdin }).on('line', line => {
    if (!line.trim()) return;
    const cmd = JSON.parse(line);
    Promise.resolve()
      .then(() => handlers[cmd.cmd]!(cmd))
      .catch(error => emit({ type: 'error', cmd: cmd.cmd, id: cmd.id, message: String(error?.stack ?? error) }));
  });

  const server = PORT ? await createNodeServer(mastra, { tools: {}, studio: false, isDev: false }) : undefined;
  emit({ type: 'ready', port: PORT ? Number(PORT) : undefined });
}

main().catch(error => {
  emit({ type: 'error', message: String(error?.stack ?? error) });
  process.exit(1);
});

/**
 * Support for `restart-agreement.test.ts` (COR-1382).
 *
 * The harness's `inprocess` mechanism restarts a run by shutting the old Mastra
 * down and building a new one **in the same module graph** over the same
 * file-backed storage. This module does the same, except each generation is
 * built through `loadGraph()` (`vi.resetModules()` plus fresh imports), so graph
 * 2 has its own module singletons. Storage is shared, exactly like the harness's
 * shared `LibSQLStore` file.
 *
 * These cells drive their own generations rather than using
 * `createRestartScenario`: several of them continue a **suspended** run through
 * `resume()`, which `restart()` deliberately refuses (a suspension is a
 * human-in-the-loop pause, not a crash), and a shared store keeps the vehicle as
 * close to the harness's as possible. That isolates one variable — module-graph
 * freshness — against the harness baseline.
 */
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { loadGraph } from './restart-harness';

export type ScriptMessage = { role: string; content: unknown };
export type ScriptToolCall = { name: string; args?: Record<string, unknown>; id?: string };
export type ScriptStep =
  | { text: string }
  | { tools: ScriptToolCall[] }
  | { error: string; retryable?: boolean; midStream?: boolean };
export type Script = (prompt: ScriptMessage[]) => ScriptStep;
export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  [key: string]: number | undefined;
};

const parts = (m: ScriptMessage): Array<Record<string, any>> =>
  Array.isArray(m.content) ? (m.content as Array<Record<string, any>>) : [];

/** Tool results already in the prompt, oldest first. Port of the harness helper. */
export function toolResults(prompt: ScriptMessage[]) {
  return prompt
    .filter(m => m.role === 'tool')
    .flatMap(parts)
    .filter(p => p.type === 'tool-result');
}

export function lastUserText(prompt: ScriptMessage[]) {
  const user = prompt.filter(m => m.role === 'user').at(-1);
  if (!user) return '';
  if (typeof user.content === 'string') return user.content;
  return parts(user)
    .map(p => p.text ?? '')
    .join('');
}

type ModelOptions = {
  /** Called for every request the model receives; `options` is the raw AI-SDK call options. */
  onCall?: (prompt: ScriptMessage[], step: ScriptStep, options: Record<string, unknown>) => void;
  /** `false` reports no usage at all; a function can vary it per call. */
  usage?: boolean | Usage | ((prompt: ScriptMessage[], step: ScriptStep) => Usage | undefined);
};

function scriptError(step: { error: string; retryable?: boolean }) {
  const err = new Error(step.error) as Error & Record<symbol | string, unknown>;
  if (step.retryable) {
    err[Symbol.for('vercel.ai.error')] = true;
    err[Symbol.for('vercel.ai.error.AI_APICallError')] = true;
    err.isRetryable = true;
    err.statusCode = 503;
  }
  return err;
}

/** Port of the harness's deterministic `LanguageModelV2`. */
export function createScriptModel(script: Script, { onCall, usage = true }: ModelOptions = {}) {
  const reported = (prompt: ScriptMessage[], step: ScriptStep) => {
    if (typeof usage === 'function') return usage(prompt, step);
    if (usage === true) return { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    if (usage === false) return undefined;
    return usage;
  };
  return {
    specificationVersion: 'v2' as const,
    provider: 'cor1382-agreement',
    modelId: 'script',
    supportedUrls: {},
    async doGenerate(options: { prompt: ScriptMessage[] } & Record<string, unknown>) {
      const { prompt } = options;
      const step = script(prompt);
      onCall?.(prompt, step, options);
      if ('error' in step) throw scriptError(step);
      const offset = toolResults(prompt).length;
      const content =
        'text' in step
          ? [{ type: 'text' as const, text: step.text }]
          : step.tools.map((t, i) => ({
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: t.id ?? `call-${offset + i + 1}`,
              toolName: t.name,
              input: JSON.stringify(t.args ?? {}),
            }));
      const use = reported(prompt, step);
      return {
        content,
        finishReason: 'text' in step ? ('stop' as const) : ('tool-calls' as const),
        ...(use ? { usage: use } : {}),
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream(options: { prompt: ScriptMessage[] } & Record<string, unknown>) {
      const { prompt } = options;
      const step = script(prompt);
      onCall?.(prompt, step, options);
      if ('error' in step && !step.midStream) throw scriptError(step);
      const use = reported(prompt, step);
      const offset = toolResults(prompt).length;
      if ('error' in step) {
        const queued: Record<string, unknown>[] = [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'partial ' },
        ];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: new ReadableStream({
            pull(c) {
              const part = queued.shift();
              if (part) c.enqueue(part);
              else c.error(scriptError(step));
            },
          }),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] });
            if ('text' in step) {
              c.enqueue({ type: 'text-start', id: 't' });
              c.enqueue({ type: 'text-delta', id: 't', delta: step.text });
              c.enqueue({ type: 'text-end', id: 't' });
              c.enqueue({ type: 'finish', finishReason: 'stop', usage: use });
            } else {
              step.tools.forEach((t, i) =>
                c.enqueue({
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: t.id ?? `call-${offset + i + 1}`,
                  toolName: t.name,
                  input: JSON.stringify(t.args ?? {}),
                  providerExecuted: false,
                }),
              );
              c.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: use });
            }
            c.close();
          },
        }),
      };
    },
  };
}

/** A tool that parks at `blockAt` on generation 1 until the gate is released. */
export function gateToolSpec(gate: { wait: () => Promise<void> }, blockAt: number) {
  return {
    /** Runs before every tool call; call from the tool's `execute`. */
    async park(n: number, generation: number) {
      if (generation === 1 && n === blockAt) await gate.wait();
    },
  };
}

export type AgreementGraph = {
  core: any;
  /** The wrapped runner (`createDurableAgent` / `createEventedAgent`) or the plain agent. */
  runner: any;
  /** The plain agent handed to the factory. */
  plain: any;
  memory: any;
  mastra: any;
  storage: any;
  generation: number;
};

/**
 * Builds one generation in a fresh module graph over the *same* storage object,
 * mirroring the harness's `build(generation)` + per-generation `ctx.memory(storage)`.
 */
export async function buildAgreementGraph<A>(opts: {
  storage: any;
  id: string;
  engine?: 'plain' | 'durable' | 'evented';
  build: (ctx: { core: any; storage: any; memory: any; generation: number }) => A;
  generation: number;
  /** Set false to prove what happens when evented workers are never started. Default true. */
  startWorkers?: boolean;
  /**
   * Extra `Mastra` config for this generation (e.g. `{ workflows }` for cases that
   * register a workflow so its runs are backed by the shared storage). Evaluated
   * after `build`, so a workflow created inside `build` can be returned here.
   */
  mastraExtra?: (ctx: { core: any; storage: any; memory: any; generation: number }) => Record<string, unknown>;
  /**
   * Overrides the default bare `MockMemory`. Cases that need memory features (working
   * memory, specific config) build their own instance here, mirroring the harness's
   * `ctx.memory(storage, options)`.
   */
  memory?: (ctx: { MockMemory: any; core: any; storage: any; generation: number }) => any;
}): Promise<AgreementGraph & { agent: A }> {
  const core = await loadGraph();
  const { RequestContext } = await import('../../../request-context');
  const { MockMemory } = await import('../../../memory/mock');
  const memory = opts.memory
    ? opts.memory({ MockMemory, core, storage: opts.storage, generation: opts.generation })
    : new MockMemory({ storage: opts.storage });
  const plain = opts.build({ core, storage: opts.storage, memory, generation: opts.generation });
  const engine = opts.engine ?? 'plain';
  const runner =
    engine === 'plain'
      ? plain
      : engine === 'durable'
        ? core.createDurableAgent({ agent: plain as any })
        : core.createEventedAgent({ agent: plain as any });
  const mastra = new core.Mastra({
    logger: false,
    storage: opts.storage,
    agents: { [opts.id]: runner as any },
    recovery: { durableAgents: 'auto' },
    ...(opts.mastraExtra?.({ core, storage: opts.storage, memory, generation: opts.generation }) ?? {}),
  });
  if (engine === 'evented' && opts.startWorkers !== false) await mastra.startWorkers();
  return {
    core: { ...core, RequestContext },
    agent: plain,
    plain,
    runner,
    memory,
    mastra,
    storage: opts.storage,
    generation: opts.generation,
  };
}

/**
 * Ends a generation's hold on `runId` the way its process dying would: its
 * claim heartbeats stop, and its storage claim lapses (released through the
 * store, which leaves the same not-live record an expired lease does). Work it
 * has parked stays parked.
 */
export async function lapseOwnership(gen: AgreementGraph, runId: string) {
  gen.core.resetExecutionFences();
  const workflows = await gen.storage.getStore('workflows');
  const record = await workflows.getRunOwnership({ runId });
  if (record?.live) {
    await workflows.releaseRunOwnership({ runId, generation: record.generation, ownerId: record.ownerId });
  }
}

/** Reads a workflow row's snapshot, parsed. */
export async function readRow(storage: any, runId: string, workflowName: string) {
  const store = await storage.getStore('workflows');
  const row = await store.getWorkflowRunById({ runId, workflowName });
  if (!row) return undefined;
  return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
}

/** Drains a stream result into the same shape the harness's `consume()` records. */
export async function consume(
  result: { fullStream: AsyncIterable<any>; getFullOutput?: () => Promise<any> },
  { stopOn }: { stopOn?: (chunk: any) => boolean } = {},
) {
  const chunks: any[] = [];
  for await (const chunk of result.fullStream) {
    chunks.push(chunk);
    if (stopOn?.(chunk)) break;
  }
  return { chunks };
}

/**
 * Marks a run's FINISH events on its agent stream topic. `loadGraph()` does not
 * re-export the constants, so they come from the static import above — safe
 * because they are plain strings/enums, not module singletons.
 */
export async function trackFinish(pubsub: any, runId: string) {
  let count = 0;
  const topic = AGENT_STREAM_TOPIC(runId);
  await pubsub.subscribe(topic, async (event: { type: string }, ack?: () => Promise<void>) => {
    if (event.type === AgentStreamEventTypes.FINISH) count++;
    await ack?.();
  });
  return {
    get count() {
      return count;
    },
  };
}

/** Polls `fn` until it returns a truthy value. */
export async function waitFor<T>(fn: () => T | Promise<T>, { timeoutMs = 10_000, intervalMs = 25 } = {}): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

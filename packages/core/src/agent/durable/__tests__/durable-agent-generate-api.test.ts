/**
 * Ported from validation harness case T16 (generate-api).
 *
 * What this protects: the non-streaming API. `generate()` returns a
 * `FullOutput`, a suspended tool call survives as a suspension that
 * `resumeGenerate()` finishes, and `structuredOutput` parses the model's JSON
 * reply — with the same contract on plain, durable and evented.
 *
 * The `object` and `steps` variants drive all three engines through
 * `expectEngineParity` and `EngineHandle.generate()`, which runs plain's
 * `doGenerate` and the wrapped engines' workflow path off the same recorded tape
 * — the leaf-by-leaf comparison the helper performs is strictly stronger than
 * the harness's `done(contract)` deep equality, so nothing the harness checks is
 * dropped.
 *
 * The `steps` leg declares one difference, COR-1428: plain's `generate()` path
 * replays the assistant tool-call part into the next request without
 * `providerExecuted`, where the streaming path (plain's own `stream()`, and
 * durable/evented, which always stream internally) sends
 * `providerExecuted: false`. The declaration's `expect` adds exactly that flag,
 * so the helper's own staleness check fails the moment either side is fixed.
 *
 * One leg stays directly driven: `suspend`. `EngineHandle.generate()` has no
 * resume counterpart, so `resumeGenerate()` is not expressible — and its
 * signature genuinely differs (plain takes `resumeData` first, durable and
 * evented take the run id first). It still asserts every harness `evaluate()`
 * check on every engine, compares the harness's `done(contract)` object across
 * engines, and pins that plain's `generate()` resolved through `doGenerate` —
 * the entry point the harness required T16's script model to implement (its
 * header records the plain cells as INVALID without it).
 */
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { DurableAgent } from '../durable-agent';
import type {
  EngineDifference,
  EngineObservation,
  EngineParityScenario,
  ModelScript,
  ParityEngine,
  ParityStreamOptions,
} from './parity-harness';
import { expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const AGENT_ID = 't16-agent';
const MAX_STEPS = 5;
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const T16_USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const MEMORY = { thread: 't16-thread', resource: 't16-resource' };
const OBJECT_SCHEMA = z.object({ amount: z.number(), currency: z.string() });
const PARSED_OBJECT = { amount: 42, currency: 'EUR' };
const STEPS_COMMITS = 2;

/**
 * COR-1428: plain resolves `generate()` through `doGenerate`, whose replayed
 * assistant tool-call parts carry no `providerExecuted`, while the streaming
 * path (plain's own `stream()`, and durable/evented, which always stream
 * internally) sets it to `false`.
 */
const COR_1428_REASON =
  "COR-1428: plain's generate() path replays assistant tool-call parts without `providerExecuted`, " +
  'where the streaming path (plain’s own stream(), and durable/evented) sends `providerExecuted: false`';

/**
 * Adds the flag plain's `generate()` path omits, on exactly the parts the
 * streaming path stamps: replayed assistant tool-call parts.
 */
function withReplayedProviderExecuted(plain: EngineObservation): EngineObservation {
  return {
    ...plain,
    requests: plain.requests.map(request => ({
      ...request,
      prompt: (request.prompt as unknown as PromptMessage[]).map(message => {
        if (message.role !== 'assistant' || !Array.isArray(message.content)) return message;
        return {
          ...message,
          content: (message.content as Array<Record<string, unknown>>).map(part =>
            // Plain's path keeps the key but leaves it `undefined`; the
            // streaming path stamps `false`.
            part.type === 'tool-call' && part.providerExecuted === undefined
              ? { ...part, providerExecuted: false }
              : part,
          ),
        };
      }),
    })) as unknown as EngineObservation['requests'],
  };
}

const COR_1428: EngineDifference = { reason: COR_1428_REASON, expect: withReplayedProviderExecuted };

type PromptPart = { type?: string; text?: string; toolName?: string; toolCallId?: string };
type PromptMessage = { role: string; content: unknown };
type ScriptStep = { text: string } | { tools: Array<{ name: string; args?: Record<string, unknown> }> };
type Script = (prompt: PromptMessage[]) => ScriptStep;

function promptParts(message: PromptMessage): PromptPart[] {
  return Array.isArray(message.content) ? (message.content as unknown as PromptPart[]) : [];
}

/** Tool results already in the prompt, oldest first (the harness's `toolResults`). */
function toolResults(prompt: ReadonlyArray<PromptMessage>): PromptPart[] {
  return prompt
    .filter(message => message.role === 'tool')
    .flatMap(promptParts)
    .filter(part => part.type === 'tool-result');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

type ToolLog = Array<{ engine?: ParityEngine; tool: string; event: string }>;

function createStepTool(log: ToolLog, engine?: ParityEngine) {
  return createTool({
    id: 'step',
    description: 'Perform numbered step n. Slow.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      log.push({ engine, tool: 'step', event: 'commit' });
      return { done: n };
    },
  });
}

function createConfirmTool(log: ToolLog) {
  return createTool({
    id: 'confirm',
    description: 'Ask the user to confirm a payment. Suspends until they answer.',
    inputSchema: z.object({ amount: z.number() }),
    suspendSchema: z.object({ prompt: z.string() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async ({ amount }, context) => {
      const resumeData = context?.agent?.resumeData;
      log.push({ tool: 'confirm', event: resumeData ? 'resumed' : 'start' });
      if (!resumeData) return context?.agent?.suspend?.({ prompt: `Pay ${amount}?` });
      if (resumeData.confirmed) log.push({ tool: 'confirm', event: 'commit' });
      return { confirmed: resumeData.confirmed, amount };
    },
  });
}

function t16Agent(model: LanguageModelV2, tools: Record<string, unknown>) {
  return new Agent<string, any, any>({
    id: AGENT_ID,
    name: 't16-agent',
    instructions: 'Follow the script.',
    model,
    memory: new MockMemory(),
    tools,
  });
}

// ---------------------------------------------------------------------------
// Script model — implements both entry points, so one script drives every engine
// ---------------------------------------------------------------------------

function generateContent(step: ScriptStep, offset: number) {
  if ('text' in step) return [{ type: 'text' as const, text: step.text }];
  return step.tools.map((tool, index) => ({
    type: 'tool-call' as const,
    toolCallType: 'function' as const,
    toolCallId: `call-${offset + index + 1}`,
    toolName: tool.name,
    input: JSON.stringify(tool.args ?? {}),
  }));
}

function streamParts(step: ScriptStep, offset: number): LanguageModelV2StreamPart[] {
  if ('text' in step) {
    return [
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 't' },
      { type: 'text-delta' as const, id: 't', delta: step.text },
      { type: 'text-end' as const, id: 't' },
      { type: 'finish' as const, finishReason: 'stop' as const, usage: T16_USAGE },
    ];
  }
  return [
    { type: 'stream-start' as const, warnings: [] },
    ...step.tools.map(
      (tool, index): LanguageModelV2StreamPart => ({
        type: 'tool-call',
        toolCallId: `call-${offset + index + 1}`,
        toolName: tool.name,
        input: JSON.stringify(tool.args ?? {}),
        providerExecuted: false,
      }),
    ),
    { type: 'finish' as const, finishReason: 'tool-calls' as const, usage: T16_USAGE },
  ];
}

/** Every response is a pure function of the prompt, so no counter lives in the process. */
function createScriptModel(script: Script) {
  const calls: Array<'generate' | 'stream'> = [];
  const model = new MockLanguageModelV2({
    doGenerate: async (options: LanguageModelV2CallOptions) => {
      calls.push('generate');
      const prompt = options.prompt as unknown as PromptMessage[];
      const step = script(prompt);
      return {
        content: generateContent(step, toolResults(prompt).length),
        finishReason: 'text' in step ? ('stop' as const) : ('tool-calls' as const),
        usage: T16_USAGE,
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    doStream: async (options: LanguageModelV2CallOptions) => {
      calls.push('stream');
      const prompt = options.prompt as unknown as PromptMessage[];
      const step = script(prompt);
      const parts: LanguageModelV2StreamPart[] = streamParts(step, toolResults(prompt).length);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream(parts),
      };
    },
  });
  return { model: model as unknown as LanguageModelV2, calls };
}

/**
 * The `suspend` script: ask for `confirm` until it has one result, then echo it.
 */
const SUSPEND_SCRIPT: Script = prompt =>
  toolResults(prompt).length
    ? { text: `answered ${JSON.stringify(toolResults(prompt).at(-1))}` }
    : { tools: [{ name: 'confirm', args: { amount: 42 } }] };

// ---------------------------------------------------------------------------
// Direct drive: suspend only (the helper's generate() has no resume)
// ---------------------------------------------------------------------------

type T16Options = {
  memory?: { thread: string; resource: string };
  runId?: string;
  maxSteps?: number;
  toolCallId?: string;
};

type T16Output = {
  text: string;
  finishReason: string | undefined;
  steps: unknown[];
  toolCalls: Array<{ payload?: { toolCallId?: string }; toolCallId?: string }>;
  toolResults: Array<{ payload?: { result?: unknown }; result?: unknown }>;
  object: unknown;
  suspendPayload: unknown;
  error: Error | undefined;
};

type T16ResumeGenerate = {
  (resumeData: unknown, options?: T16Options): Promise<T16Output>;
  (runId: string, resumeData: unknown, options?: T16Options): Promise<T16Output>;
};

type T16Runner = {
  generate(messages: string, options?: T16Options): Promise<T16Output>;
  resumeGenerate: T16ResumeGenerate;
};

type Summary = {
  text: string | undefined;
  finishReason: string | undefined;
  steps: number | undefined;
  toolResults: unknown[];
  object: unknown;
  suspended: boolean;
  error: string | undefined;
};

/** The harness's `summarize`: exactly the fields its contract is built from. */
function summarize(output: T16Output | undefined): Summary | undefined {
  if (!output) return undefined;
  return {
    text: output.text,
    finishReason: output.finishReason,
    steps: output.steps?.length,
    toolResults: (output.toolResults ?? []).map(entry => entry.payload ?? entry),
    object: output.object,
    suspended: !!output.suspendPayload || output.finishReason === 'suspended',
    error: output.error ? String(output.error.message ?? output.error) : undefined,
  };
}

function lastToolCallId(output: T16Output): string {
  const last = output.toolCalls?.at(-1);
  return last?.payload?.toolCallId ?? last?.toolCallId ?? 'call-1';
}

type EngineRun = {
  engine: ParityEngine;
  first: Summary | undefined;
  resumed: Summary | undefined;
  toolLog: ToolLog;
  /** Model calls the engine made, in order — plain must resolve through `doGenerate`. */
  calls: Array<'generate' | 'stream'>;
};

async function runOnEngine(engine: ParityEngine): Promise<EngineRun> {
  const toolLog: ToolLog = [];
  const { model, calls } = createScriptModel(SUSPEND_SCRIPT);
  const agent = t16Agent(model, { confirm: createConfirmTool(toolLog) });

  let wrapper: DurableAgent<string, any, any> | undefined;
  let pubsub: EventEmitterPubSub | undefined;
  if (engine === 'durable') {
    pubsub = new EventEmitterPubSub();
    wrapper = createDurableAgent({ agent, pubsub });
  } else if (engine === 'evented') {
    wrapper = createEventedAgent({ agent });
  }

  // Every engine runs on a host, as it would in a real app: a suspended run is
  // only resumable when the run's snapshot reached storage.
  const host = new Mastra({
    agents: { [agent.id]: wrapper ?? agent },
    storage: new InMemoryStore(),
    logger: false,
  });

  if (wrapper && engine === 'evented') {
    // Without atomic storage the evented agent silently runs on the default
    // engine, which would make "evented == plain" a durable-vs-plain check.
    const engineType = (wrapper.getWorkflow() as { engineType?: string }).engineType;
    expect(engineType, 'evented workflow engine type').toBe('evented');
  }

  const runner = (wrapper ?? agent) as unknown as T16Runner;
  const memory = { thread: `t16-thread-suspend-${engine}`, resource: `t16-resource-${engine}` };
  const runId = `t16-run-suspend-${engine}`;
  const options: T16Options = { memory, runId, maxSteps: MAX_STEPS };

  try {
    const first = await runner.generate('Go.', options);
    const run: EngineRun = { engine, first: summarize(first), resumed: undefined, toolLog, calls };
    const toolCallId = lastToolCallId(first);
    // The resume signatures really do differ: plain takes `resumeData` first,
    // durable and evented take the run id first.
    const resumed =
      engine === 'plain'
        ? await runner.resumeGenerate({ confirmed: true }, { runId, toolCallId, memory })
        : await runner.resumeGenerate(runId, { confirmed: true }, { toolCallId, memory });
    run.resumed = summarize(resumed);
    return run;
  } finally {
    await host.shutdown();
    await pubsub?.close();
  }
}

/** The harness's `done(contract)` for the one directly driven variant. */
function contractOf(run: EngineRun) {
  return {
    suspended: run.first?.suspended,
    resumed: run.resumed && { text: run.resumed.text, finishReason: run.resumed.finishReason },
  };
}

async function runOnEveryEngine(): Promise<Map<ParityEngine, EngineRun>> {
  const runs = new Map<ParityEngine, EngineRun>();
  for (const engine of ENGINES) runs.set(engine, await runOnEngine(engine));
  return runs;
}

describe('T16 generate API: generate() / resumeGenerate() / structured output (plain, durable, evented)', () => {
  it('object: every engine parses the same structured output', async () => {
    // `ParityStreamOptions` deliberately omits `structuredOutput` (it types
    // differently on plain and on the wrapped agents), so the option is widened
    // here and passed through to whichever `generate()` the engine owns.
    const options: ParityStreamOptions & { structuredOutput?: unknown } = {
      memory: MEMORY,
      maxSteps: MAX_STEPS,
      structuredOutput: { schema: OBJECT_SCHEMA },
    };
    const scenario: EngineParityScenario = {
      model: { respond: () => textOnlyTape(JSON.stringify(PARSED_OBJECT), T16_USAGE) } satisfies ModelScript,
      buildAgent: ({ model }) => t16Agent(model, {}),
      run: async handle => {
        await handle.generate('Go.', options);
      },
    };

    const results = await expectEngineParity(scenario);

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.generate, `${engine} drove the turn through generate()`).toBe(true);
      expect(turn.chunks, `${engine} streamed chunks`).toHaveLength(0);
      expect(turn.error, `${engine} generate() returned an error`).toBeUndefined();
      expect(turn.fullOutput.object, `${engine} structured object`).toEqual(PARSED_OBJECT);
      expect(results[engine]!.requests, `${engine} model calls`).toHaveLength(1);
    }
  });

  it('steps: every engine returns the same FullOutput contract', async () => {
    const toolLog: ToolLog = [];
    const scenario: EngineParityScenario = {
      // Two tool steps, then text — the harness's `stepScript(2)`, driven off
      // the prompt so no counter has to live between model calls.
      model: {
        respond: request => {
          const done = toolResults(request.prompt as unknown as PromptMessage[]).length;
          return done < STEPS_COMMITS
            ? toolCallTape('step', { n: done + 1 }, `call-${done + 1}`, T16_USAGE)
            : textOnlyTape(`finished ${done} steps`, T16_USAGE);
        },
      } satisfies ModelScript,
      buildAgent: ({ engine, model }) => t16Agent(model, { step: createStepTool(toolLog, engine) }),
      run: async handle => {
        await handle.generate('Go.', { memory: MEMORY, maxSteps: MAX_STEPS });
      },
      differences: { durable: COR_1428, evented: COR_1428 },
    };

    const results = await expectEngineParity(scenario);

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.generate, `${engine} drove the turn through generate()`).toBe(true);
      expect(turn.chunks, `${engine} streamed chunks`).toHaveLength(0);
      expect(turn.error, `${engine} generate() returned an error`).toBeUndefined();
      // The harness's `steps` contract: text, finish reason and step count.
      expect(turn.fullOutput.text, `${engine} final text`).toBe('finished 2 steps');
      expect(turn.fullOutput.finishReason, `${engine} finish reason`).toBe('stop');
      expect(turn.stepCount, `${engine} steps recorded`).toBe(3);
      // Two tool turns and then the closing turn, one model call each.
      expect(results[engine]!.requests, `${engine} model calls`).toHaveLength(3);
    }

    for (const engine of ENGINES) {
      expect(
        toolLog.filter(entry => entry.engine === engine && entry.tool === 'step' && entry.event === 'commit'),
        `${engine} step commits`,
      ).toHaveLength(STEPS_COMMITS);
    }
  });

  it('suspend: a suspended generate() resumes with the same contract on every engine', async () => {
    const runs = await runOnEveryEngine();

    for (const engine of ENGINES) {
      const run = runs.get(engine)!;
      expect(run.first, `${engine} returned no output`).toBeDefined();
      expect(run.first?.error, `${engine} generate() returned an error`).toBeUndefined();
      expect(run.first?.suspended, `${engine} reported the suspension`).toBe(true);
      expect(run.resumed?.error, `${engine} resumeGenerate() returned an error`).toBeUndefined();
      expect(run.resumed?.finishReason, `${engine} resumed finish reason`).toBe('stop');
      expect(run.resumed?.text, `${engine} resumed text`).toMatch(/"confirmed":true/);
      expect(
        run.toolLog.filter(entry => entry.tool === 'confirm' && entry.event === 'commit'),
        `${engine} confirm commits`,
      ).toHaveLength(1);
    }

    // `resumeGenerate()` is the reason this leg is direct; the plain call that
    // precedes it must still have used `doGenerate`.
    expect(runs.get('plain')!.calls[0], 'plain generate() used the doGenerate path').toBe('generate');

    const plain = contractOf(runs.get('plain')!);
    for (const engine of ['durable', 'evented'] as const) {
      expect(contractOf(runs.get(engine)!), `${engine} contract vs plain`).toEqual(plain);
    }
  });
});

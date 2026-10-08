/**
 * Ported from validation harness case T16 (generate-api).
 *
 * What this protects: the non-streaming API. `generate()` returns a
 * `FullOutput`, a suspended tool call survives as a suspension that
 * `resumeGenerate()` finishes, and `structuredOutput` parses the model's JSON
 * reply — with the same contract on plain, durable and evented.
 *
 * The `object` variant drives all three engines through `expectEngineParity` and
 * `EngineHandle.generate()`, which runs plain's `doGenerate` and the wrapped
 * engines' workflow path off the same recorded tape — the leaf-by-leaf
 * comparison the helper performs is strictly stronger than the harness's
 * `done(contract)` deep equality, so nothing the harness checks is dropped.
 *
 * Two legs stay directly driven, each for a reason the helper cannot remove:
 *
 *  - `suspend`: `EngineHandle.generate()` has no resume counterpart, so
 *    `resumeGenerate()` is not expressible — and its signature genuinely differs
 *    (plain takes `resumeData` first, durable and evented take the run id first).
 *  - `steps`: the helper also compares the model requests, and plain's
 *    `generate()` path replays the assistant tool-call part into the next
 *    request without `providerExecuted`, where the streaming path (plain's own
 *    `stream()`, and durable/evented, which always stream) sends
 *    `providerExecuted: false`. That difference is real, unrelated to the
 *    tickets this port may cite, and reported on COR-1406 (comment
 *    `83663ee6-626c-4b1e-b835-9c650709bf9b`) for a ticket decision; no ticket
 *    owns it yet, so it is deliberately not declared, and driving this leg
 *    through the helper would mean declaring a difference no ticket owns.
 *
 * Both direct legs still assert every harness `evaluate()` check on every
 * engine, compare the harness's `done(contract)` object across engines, and pin
 * that plain's `generate()` resolved through `doGenerate` — the entry point the
 * harness required T16's script model to implement (its header records the plain
 * cells as INVALID without it) and the one thing the helper cannot observe,
 * since its recording model answers both entry points from the same tape.
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
import type { EngineParityScenario, ModelScript, ParityEngine, ParityStreamOptions } from './parity-harness';
import { expectEngineParity, textOnlyTape } from './parity-harness';

const AGENT_ID = 't16-agent';
const MAX_STEPS = 5;
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const T16_USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const MEMORY = { thread: 't16-thread', resource: 't16-resource' };
const OBJECT_SCHEMA = z.object({ amount: z.number(), currency: z.string() });
const PARSED_OBJECT = { amount: 42, currency: 'EUR' };

/** Direct-driven variants: the ones the helper cannot express yet. */
type DirectVariant = 'steps' | 'suspend';

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

type ToolLog = Array<{ tool: string; event: string }>;

function createStepTool(log: ToolLog) {
  return createTool({
    id: 'step',
    description: 'Perform numbered step n. Slow.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      log.push({ tool: 'step', event: 'commit' });
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
 * Two tool steps, then text: `finished 2 steps` after two tool results. The
 * `suspend` script asks for `confirm` until it has one result, then echoes it.
 */
function scriptFor(variant: DirectVariant): Script {
  if (variant === 'steps') {
    return prompt => {
      const done = toolResults(prompt).length;
      return done < 2 ? { tools: [{ name: 'step', args: { n: done + 1 } }] } : { text: `finished ${done} steps` };
    };
  }
  return prompt =>
    toolResults(prompt).length
      ? { text: `answered ${JSON.stringify(toolResults(prompt).at(-1))}` }
      : { tools: [{ name: 'confirm', args: { amount: 42 } }] };
}

// ---------------------------------------------------------------------------
// Direct drive: steps (blocked above) and suspend (no helper resume)
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

async function runOnEngine(variant: DirectVariant, engine: ParityEngine): Promise<EngineRun> {
  const toolLog: ToolLog = [];
  const { model, calls } = createScriptModel(scriptFor(variant));
  const agent = t16Agent(
    model,
    variant === 'steps' ? { step: createStepTool(toolLog) } : { confirm: createConfirmTool(toolLog) },
  );

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
  const memory = { thread: `t16-thread-${variant}-${engine}`, resource: `t16-resource-${engine}` };
  const runId = `t16-run-${variant}-${engine}`;
  const options: T16Options = { memory, runId, maxSteps: MAX_STEPS };

  try {
    const first = await runner.generate('Go.', options);
    const run: EngineRun = { engine, first: summarize(first), resumed: undefined, toolLog, calls };
    if (variant === 'suspend') {
      const toolCallId = lastToolCallId(first);
      // The resume signatures really do differ: plain takes `resumeData` first,
      // durable and evented take the run id first.
      const resumed =
        engine === 'plain'
          ? await runner.resumeGenerate({ confirmed: true }, { runId, toolCallId, memory })
          : await runner.resumeGenerate(runId, { confirmed: true }, { toolCallId, memory });
      run.resumed = summarize(resumed);
    }
    return run;
  } finally {
    await host.shutdown();
    await pubsub?.close();
  }
}

/** The harness's `done(contract)`, rebuilt per engine. */
function contractOf(run: EngineRun, variant: DirectVariant) {
  const first = run.first;
  if (variant === 'suspend') {
    return {
      suspended: first?.suspended,
      resumed: run.resumed && { text: run.resumed.text, finishReason: run.resumed.finishReason },
    };
  }
  return { text: first?.text, finishReason: first?.finishReason, steps: first?.steps, object: first?.object };
}

async function runDirectOnEveryEngine(variant: DirectVariant): Promise<Map<ParityEngine, EngineRun>> {
  const runs = new Map<ParityEngine, EngineRun>();
  for (const engine of ENGINES) runs.set(engine, await runOnEngine(variant, engine));
  return runs;
}

/** The `steps` leg's checks either side of the harness's cross-engine contract equality. */
function expectOrdinaryChecks(runs: Map<ParityEngine, EngineRun>) {
  for (const engine of ENGINES) {
    const first = runs.get(engine)!.first;
    expect(first, `${engine} returned no output`).toBeDefined();
    expect(first?.error, `${engine} generate() returned an error`).toBeUndefined();
    expect(first?.text, `${engine} final text`).toBe('finished 2 steps');
    expect(first?.finishReason, `${engine} finish reason`).toBe('stop');
    expect(first?.steps, `${engine} steps recorded`).toBe(3);
  }
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
    const variant = 'steps' as const;
    const runs = await runDirectOnEveryEngine(variant);

    expectOrdinaryChecks(runs);

    // The plain engine resolves `generate()` through `doGenerate`; durable and
    // evented stream internally, which is why this leg is driven directly (see
    // the header: the helper's request comparison surfaces a real, unticketed
    // `providerExecuted` difference on this path).
    expect(runs.get('plain')!.calls[0], 'plain generate() used the doGenerate path').toBe('generate');

    // The harness compares both cells' contracts with a deep equality check.
    const plain = contractOf(runs.get('plain')!, variant);
    for (const engine of ['durable', 'evented'] as const) {
      expect(contractOf(runs.get(engine)!, variant), `${engine} contract vs plain`).toEqual(plain);
    }
  });

  it('suspend: a suspended generate() resumes with the same contract on every engine', async () => {
    const variant = 'suspend' as const;
    const runs = await runDirectOnEveryEngine(variant);

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

    const plain = contractOf(runs.get('plain')!, variant);
    for (const engine of ['durable', 'evented'] as const) {
      expect(contractOf(runs.get(engine)!, variant), `${engine} contract vs plain`).toEqual(plain);
    }
  });
});

/**
 * Ported from validation harness case T16 (generate-api).
 *
 * What this protects: the non-streaming API. `generate()` returns a
 * `FullOutput`, a suspended tool call survives as a suspension that
 * `resumeGenerate()` finishes, and `structuredOutput` parses the model's JSON
 * reply — with the same contract on plain, durable and evented.
 *
 * Why this port drives the engines directly instead of calling
 * `expectEngineParity`: plain's `generate()` resolves through
 * `model.doGenerate` while durable and evented stream, and the frozen helper's
 * recording model deliberately throws on `doGenerate` ("scripts only support
 * doStream"), so the helper cannot drive this case at all. The harness hit the
 * same hazard — its header records the T16 batch 03-56-58 plain cells as
 * INVALID because the script model had no `doGenerate`. The helper also
 * refuses a scenario that produces no streamed turn on plain, and T16 never
 * streams.
 *
 * The port therefore builds one script model that implements BOTH
 * `doGenerate` and `doStream`, drives the same scenario on all three engines,
 * asserts every harness `evaluate()` check on every engine, and then compares
 * the harness's `done(contract)` object across engines — the same deep
 * equality the harness itself performs when both cells pass (see `pair()` in
 * harness/case-runner.mjs). Nothing the harness checks is dropped.
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
import type { ParityEngine } from './parity-harness';

const AGENT_ID = 't16-agent';
const MAX_STEPS = 5;
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const T16_USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Variant = 'steps' | 'suspend' | 'object';

// ---------------------------------------------------------------------------
// Script model — implements both entry points
// ---------------------------------------------------------------------------

type PromptPart = { type?: string; text?: string; toolName?: string; toolCallId?: string };
type PromptMessage = { role: string; content: unknown };
type ScriptStep = { text: string } | { tools: Array<{ name: string; args?: Record<string, unknown> }> };
type Script = (prompt: PromptMessage[]) => ScriptStep;

function promptParts(message: PromptMessage): PromptPart[] {
  return Array.isArray(message.content) ? (message.content as unknown as PromptPart[]) : [];
}

/** Tool results already in the prompt, oldest first (the harness's `toolResults`). */
function toolResults(prompt: PromptMessage[]): PromptPart[] {
  return prompt
    .filter(message => message.role === 'tool')
    .flatMap(promptParts)
    .filter(part => part.type === 'tool-result');
}

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

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

type T16Options = {
  memory?: { thread: string; resource: string };
  runId?: string;
  maxSteps?: number;
  structuredOutput?: { schema: unknown };
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

type EngineRun = {
  engine: ParityEngine;
  first: Summary | undefined;
  resumed: Summary | undefined;
  toolLog: ToolLog;
  /** Model calls the engine made, in order — diagnostics only, never compared. */
  calls: Array<'generate' | 'stream'>;
};

function scriptFor(variant: Variant): Script {
  if (variant === 'steps') {
    // Two tool steps, then text: `finished 2 steps` after two tool results.
    return prompt => {
      const done = toolResults(prompt).length;
      return done < 2 ? { tools: [{ name: 'step', args: { n: done + 1 } }] } : { text: `finished ${done} steps` };
    };
  }
  if (variant === 'suspend') {
    return prompt =>
      toolResults(prompt).length
        ? { text: `answered ${JSON.stringify(toolResults(prompt).at(-1))}` }
        : { tools: [{ name: 'confirm', args: { amount: 42 } }] };
  }
  return () => ({ text: '{"amount":42,"currency":"EUR"}' });
}

function lastToolCallId(output: T16Output): string {
  const last = output.toolCalls?.at(-1);
  return last?.payload?.toolCallId ?? last?.toolCallId ?? 'call-1';
}

async function runOnEngine(variant: Variant, engine: ParityEngine): Promise<EngineRun> {
  const toolLog: ToolLog = [];
  const { model, calls } = createScriptModel(scriptFor(variant));
  const agent: Agent<string, any, any> = new Agent({
    id: AGENT_ID,
    name: 't16-agent',
    instructions: 'Follow the script.',
    model,
    memory: new MockMemory(),
    ...(variant === 'steps'
      ? { tools: { step: createStepTool(toolLog) } }
      : variant === 'suspend'
        ? { tools: { confirm: createConfirmTool(toolLog) } }
        : {}),
  });

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
  const memory = { thread: `t16-thread-${engine}`, resource: `t16-resource-${engine}` };
  const runId = `t16-run-${engine}`;
  const options: T16Options = { memory, runId, maxSteps: MAX_STEPS };
  if (variant === 'object')
    options.structuredOutput = { schema: z.object({ amount: z.number(), currency: z.string() }) };

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
function contractOf(run: EngineRun, variant: Variant) {
  const first = run.first;
  if (variant === 'suspend') {
    return {
      suspended: first?.suspended,
      resumed: run.resumed && { text: run.resumed.text, finishReason: run.resumed.finishReason },
    };
  }
  return { text: first?.text, finishReason: first?.finishReason, steps: first?.steps, object: first?.object };
}

describe('T16 generate API: generate() / resumeGenerate() / structured output (plain, durable, evented)', () => {
  it.each(['steps', 'suspend', 'object'] as const)(
    '%s: every engine returns the same FullOutput contract',
    async variant => {
      const runs = new Map<ParityEngine, EngineRun>();
      for (const engine of ENGINES) {
        runs.set(engine, await runOnEngine(variant, engine));
      }

      for (const engine of ENGINES) {
        const run = runs.get(engine)!;
        const first = run.first;
        expect(first, `${engine} returned no output`).toBeDefined();
        expect(first?.error, `${engine} generate() returned an error`).toBeUndefined();

        if (variant === 'steps') {
          expect(first?.text, `${engine} final text`).toBe('finished 2 steps');
          expect(first?.finishReason, `${engine} finish reason`).toBe('stop');
          expect(first?.steps, `${engine} steps recorded`).toBe(3);
        } else if (variant === 'object') {
          expect(first?.object, `${engine} structured object`).toEqual({ amount: 42, currency: 'EUR' });
        } else {
          expect(first?.suspended, `${engine} reported the suspension`).toBe(true);
          expect(run.resumed?.error, `${engine} resumeGenerate() returned an error`).toBeUndefined();
          expect(run.resumed?.finishReason, `${engine} resumed finish reason`).toBe('stop');
          expect(run.resumed?.text, `${engine} resumed text`).toMatch(/"confirmed":true/);
          expect(
            run.toolLog.filter(entry => entry.tool === 'confirm' && entry.event === 'commit'),
            `${engine} confirm commits`,
          ).toHaveLength(1);
        }
      }

      // The plain engine resolves `generate()` through `doGenerate`; durable and evented stream
      // internally. Pin plain's first call so the generate path itself is exercised — the helper's
      // recording model throws on `doGenerate`, so this case is driven directly.
      expect(runs.get('plain')!.calls[0], 'plain generate() used the doGenerate path').toBe('generate');

      // The harness compares both cells' contracts with a deep equality check.
      const plain = contractOf(runs.get('plain')!, variant);
      for (const engine of ['durable', 'evented'] as const) {
        expect(contractOf(runs.get(engine)!, variant), `${engine} contract vs plain`).toEqual(plain);
      }
    },
  );
});

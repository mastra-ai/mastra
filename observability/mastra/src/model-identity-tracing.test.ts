/**
 * Which model AGENT_RUN and MODEL_STEP spans name, on every agent engine,
 * through a real Observability instance and TestExporter. Only the LLM is
 * mocked. AGENT_RUN names the model the run was configured with; each
 * MODEL_STEP names the model that step actually invoked.
 */
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { ResponseCache } from '@mastra/core/processors';
import type { Processor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

type Engine = 'agent' | 'durable' | 'evented';

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

/** Answers each call with the next tool call in `toolCalls`, then with final text. */
function scriptedModel(provider: string, modelId: string, toolCalls: Array<{ toolName: string; input: object }> = []) {
  let call = 0;
  return new MockLanguageModelV2({
    provider,
    modelId,
    doStream: async () => {
      const turn = call++;
      const toolCall = toolCalls[turn];
      return {
        stream: convertArrayToReadableStream(
          toolCall
            ? [
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: `call-${turn}`,
                  toolName: toolCall.toolName,
                  input: JSON.stringify(toolCall.input),
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: `answer from ${modelId}` },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function failingModel(provider: string, modelId: string) {
  return new MockLanguageModelV2({
    provider,
    modelId,
    doStream: async () => {
      throw new Error(`${modelId} is unavailable`);
    },
  });
}

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get the weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21 }),
});

const askWeather = { toolName: 'get_weather', input: { city: 'Paris' } };

function setup(engine: Engine, agent: Agent) {
  const exporter = new TestExporter();
  const registered =
    engine === 'agent' ? agent : (engine === 'durable' ? createDurableAgent : createEventedAgent)({ agent });
  const mastra = new Mastra({
    agents: { target: registered } as any,
    storage: new MockStore(),
    observability: new Observability({
      configs: { test: { serviceName: 'model-identity-tracing', exporters: [exporter] } },
    }),
  });
  const target = mastra.getAgent('target') as any;
  const consume = async (result: any) => {
    try {
      await (engine === 'agent' ? result : result.output).consumeStream();
    } catch {
      // A failed run rejects here on some engines; the spans are what matter.
    }
    await settle(exporter);
    result.cleanup?.();
  };
  return {
    exporter,
    target,
    run: async (prompt: string, options?: Record<string, unknown>) => consume(await target.stream(prompt, options)),
  };
}

/** Waits until span delivery quiesces (count stable across two checks). */
async function settle(exporter: TestExporter, maxMs = 2000) {
  let prev = -1;
  for (let waited = 0; waited < maxMs; waited += 20) {
    const n = exporter.getAllSpans().length;
    if (n > 0 && n === prev) return;
    prev = n;
    await new Promise(r => setTimeout(r, 20));
  }
}

const byStart = <T extends AnyExportedSpan>(spans: T[]) =>
  [...spans].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
const spansOf = (exporter: TestExporter, type: SpanType) => byStart(exporter.getSpansByType(type) as AnyExportedSpan[]);
const identity = (span: AnyExportedSpan | undefined) => {
  const attributes = span?.attributes as { model?: string; provider?: string } | undefined;
  return { model: attributes?.model, provider: attributes?.provider };
};
const none = { model: undefined, provider: undefined };
const acmeLarge = { model: 'acme-large', provider: 'acme' };
const globexMini = { model: 'globex-mini', provider: 'globex' };
/** MODEL_STEP spans of the generation that runs under `run`. */
const stepsUnder = (exporter: TestExporter, run: AnyExportedSpan) => {
  const generationIds = new Set(
    exporter
      .getSpansByType(SpanType.MODEL_GENERATION)
      .filter(span => span.parentSpanId === run.id)
      .map(span => span.id),
  );
  return spansOf(exporter, SpanType.MODEL_STEP).filter(step => generationIds.has(step.parentSpanId!));
};

describe.each<Engine>(['agent', 'durable', 'evented'])('%s: model on agent run and model step spans', engine => {
  it('a run of the agent configured model names that model on the agent run and on every step', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'use the tool',
      model: scriptedModel('acme', 'acme-large', [askWeather]),
      tools: { get_weather: weatherTool },
    });
    const { exporter, run } = setup(engine, agent);
    await run('weather in paris?');

    const [agentRun] = spansOf(exporter, SpanType.AGENT_RUN);
    const steps = spansOf(exporter, SpanType.MODEL_STEP);
    expect(identity(agentRun)).toEqual(acmeLarge);
    expect(steps).toHaveLength(2);
    expect(steps.map(identity)).toEqual([acmeLarge, acmeLarge]);
    // Generation and inference spans keep naming the model as they always have.
    expect(spansOf(exporter, SpanType.MODEL_GENERATION).map(identity)).toEqual([acmeLarge]);
    expect(spansOf(exporter, SpanType.MODEL_INFERENCE).map(identity)).toEqual([acmeLarge, acmeLarge]);
  });

  it('a call-time model override is the model the agent run and its step name, not the configured one', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: scriptedModel('acme', 'acme-large'),
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi', { model: scriptedModel('globex', 'globex-mini') });

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual(globexMini);
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual([globexMini]);
  });

  it('an agent whose model is a function names the model the function resolved to', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: ({ requestContext }) =>
        requestContext.get('tier') === 'pro'
          ? scriptedModel('acme', 'acme-large')
          : scriptedModel('acme', 'acme-small'),
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi', { requestContext: new RequestContext([['tier', 'pro']]) });

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual(acmeLarge);
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual([acmeLarge]);
  });

  it('a run configured with model A whose processor switches a step to model B keeps A on the agent run and records B on that step', async () => {
    const switchSecondStep: Processor = {
      id: 'switch-second-step',
      processInputStep: async ({ stepNumber }) =>
        stepNumber === 1 ? { model: scriptedModel('globex', 'globex-mini') } : {},
    };
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'use the tool',
      model: scriptedModel('acme', 'acme-large', [askWeather]),
      tools: { get_weather: weatherTool },
      inputProcessors: [switchSecondStep],
    });
    const { exporter, run } = setup(engine, agent);
    await run('weather in paris?');

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual(acmeLarge);
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual([acmeLarge, globexMini]);
  });

  it('a fallback list whose first model fails names the first model on the agent run and the backup on the step it served', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: [
        { model: failingModel('acme', 'acme-large'), maxRetries: 0 },
        { model: scriptedModel('globex', 'globex-mini'), maxRetries: 0 },
      ],
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi');

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual(acmeLarge);
    // Durable engines keep the failed attempt as a step of its own; the regular agent retries inside one step.
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual(
      engine === 'agent' ? [globexMini] : [acmeLarge, globexMini],
    );
  });

  it('a run whose input processor throws before the model call names the model on the agent run and none on a step', async () => {
    const rejectInput: Processor = {
      id: 'reject-input',
      processInputStep: async () => {
        throw new Error('input rejected');
      },
    };
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: scriptedModel('acme', 'acme-large'),
      inputProcessors: [rejectInput],
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi');

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual(acmeLarge);
    // Only the regular agent opens its step before the input processors run.
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual(engine === 'agent' ? [none] : []);
  });

  it('a step whose provider call fails still names the model it called', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: failingModel('acme', 'acme-large'),
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi');

    expect(spansOf(exporter, SpanType.AGENT_RUN)[0]!.errorInfo?.message).toBe('acme-large is unavailable');
    expect(spansOf(exporter, SpanType.MODEL_STEP).map(identity)).toEqual([acmeLarge]);
  });

  it('a sub-agent run names its own model, and the parent steps keep naming the parent model', async () => {
    const helper = new Agent({
      id: 'helper',
      name: 'helper',
      description: 'answers questions',
      instructions: 'x',
      model: scriptedModel('globex', 'globex-mini'),
    });
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'ask the helper',
      model: scriptedModel('acme', 'acme-large', [{ toolName: 'agent-helper', input: { prompt: 'help' } }]),
      agents: { helper },
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi');

    const runs = spansOf(exporter, SpanType.AGENT_RUN);
    const parentRun = runs.find(span => span.entityId === 'weather')!;
    const helperRun = runs.find(span => span.entityId === 'helper')!;
    expect(identity(parentRun)).toEqual(acmeLarge);
    expect(identity(helperRun)).toEqual(globexMini);
    expect(stepsUnder(exporter, parentRun).map(identity)).toEqual([acmeLarge, acmeLarge]);
    expect(stepsUnder(exporter, helperRun).map(identity)).toEqual([globexMini]);
  });

  it('a run suspended for approval and resumed names the model on both agent runs and on the steps after the resume', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'use the tool',
      model: scriptedModel('acme', 'acme-large', [askWeather]),
      tools: {
        get_weather: createTool({
          id: 'get_weather',
          description: 'Get the weather',
          inputSchema: z.object({ city: z.string() }),
          requireApproval: true,
          execute: async ({ city }) => ({ forecast: `Sunny in ${city}` }),
        }),
      },
    });
    const { exporter, target } = setup(engine, agent);
    const drainUntil = async (result: any, chunkType: string) => {
      for await (const chunk of result.fullStream) {
        if (chunk.type === chunkType) break;
      }
      await settle(exporter);
    };
    const first = await target.stream('weather in paris?');
    await drainUntil(first, 'tool-call-approval');
    const resumed = await target.approveToolCall({ runId: first.runId });
    await drainUntil(resumed, 'finish');
    first.cleanup?.();
    resumed.cleanup?.();

    const runs = spansOf(exporter, SpanType.AGENT_RUN);
    expect(runs).toHaveLength(2);
    expect(runs[1]!.name).toContain('(resumed)');
    expect(runs.map(identity)).toEqual([acmeLarge, acmeLarge]);
    expect(stepsUnder(exporter, runs[0]!).map(identity)).toEqual([acmeLarge]);
    const resumedSteps = stepsUnder(exporter, runs[1]!);
    expect(identity(resumedSteps.at(-1))).toEqual(acmeLarge);
    // The regular agent finishes the approved tool call in a step of its own, which calls no model.
    expect(resumedSteps.slice(0, -1).map(identity)).toEqual(engine === 'agent' ? [none] : []);
  });

  it('a step served from the response cache names no model, while the agent run still does', async () => {
    const agent = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'x',
      model: scriptedModel('acme', 'acme-large'),
      inputProcessors: [new ResponseCache({ cache: new InMemoryServerCache() })],
    });
    const { exporter, run } = setup(engine, agent);
    await run('hi');
    await run('hi');

    const runs = spansOf(exporter, SpanType.AGENT_RUN);
    expect(runs).toHaveLength(2);
    expect(runs.map(identity)).toEqual([acmeLarge, acmeLarge]);
    expect(stepsUnder(exporter, runs[0]!).map(identity)).toEqual([acmeLarge]);
    expect(stepsUnder(exporter, runs[1]!).map(identity)).toEqual([none]);
  });
});

describe('legacy agent: model on the agent run span', () => {
  it('a generateLegacy run names the v1 model it was configured with on the agent run', async () => {
    const agent = new Agent({
      id: 'legacy',
      name: 'legacy',
      instructions: 'x',
      model: new MockLanguageModelV1({
        provider: 'acme',
        modelId: 'acme-v1',
        doGenerate: async () => ({
          text: 'ok',
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }) as any,
    });
    const { exporter, target } = setup('agent', agent);
    await target.generateLegacy('hi');
    await settle(exporter);

    expect(identity(spansOf(exporter, SpanType.AGENT_RUN)[0])).toEqual({ model: 'acme-v1', provider: 'acme' });
  });
});

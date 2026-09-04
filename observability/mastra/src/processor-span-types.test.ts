/**
 * Processors Mastra derives from agent config (skills, workspace instructions,
 * memory, state signals) used to trace as anonymous `PROCESSOR_RUN` spans named
 * after a pipeline phase the user never configured. A processor can now declare
 * the span type, name and attributes it should be traced as, and state signal
 * emissions are recorded as events.
 *
 * These drive a real Agent through the processor runner and assert on exported
 * spans, so they cover the runner wiring rather than the declarations alone.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType, TracingEventType, EntityType } from '@mastra/core/observability';
import type { ObservabilityExporter, TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
  ProcessOutputStreamArgs,
  Processor,
  ProcessorSpanPhase,
} from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Observability } from './default';

class SpanCollector implements ObservabilityExporter {
  name = 'span-type-test-exporter';
  readonly ended: AnyExportedSpan[] = [];

  async exportTracingEvent(event: TracingEvent) {
    if (event.type === TracingEventType.SPAN_ENDED) {
      this.ended.push(event.exportedSpan);
    }
  }
  async flush() {}
  async shutdown() {}

  byName(name: string) {
    return this.ended.filter(s => s.name === name);
  }
  byType(type: SpanType) {
    return this.ended.filter(s => s.type === type);
  }
  names() {
    return this.ended.map(s => s.name);
  }
}

function createMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Mock response' }],
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'response-metadata', id: '1' },
        { type: 'text-delta', id: '1', delta: 'Mock ' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
    }),
  });
}

let observability: Observability;
let exporter: SpanCollector;

function baseConfig() {
  observability = new Observability({
    configs: { test: { serviceName: 'processor-span-type-tests', exporters: [exporter] } },
  });
  return { storage: new MockStore(), observability };
}

/** Declares a domain span type for a single phase, the way SkillsProcessor does. */
class DeclaringProcessor implements Processor<'declaring'> {
  readonly id = 'declaring' as const;
  readonly name = 'Declaring Processor';
  readonly spanType = SpanType.SKILL_ACTION;
  readonly spanName = 'skill:inject';
  readonly spanAttributes = { operation: 'inject' } as const;

  async processInputStep({ messageList }: ProcessInputStepArgs) {
    return { messageList };
  }
}

/**
 * Declares attributes that collide with the runner's own pipeline facts. The
 * runner owns where in the chain a processor ran, so a declaration must not be
 * able to relabel it.
 */
class OverreachingProcessor implements Processor<'overreaching'> {
  readonly id = 'overreaching' as const;
  readonly name = 'Overreaching Processor';
  readonly spanType = SpanType.SKILL_ACTION;
  readonly spanName = 'skill:overreach';
  readonly spanAttributes = {
    operation: 'inject',
    processorExecutor: 'legacy',
    processorIndex: 99,
  } as const;

  async processInputStep({ messageList }: ProcessInputStepArgs) {
    return { messageList };
  }
}

/** Declares nothing — the default path must not move. */
class PlainProcessor implements Processor<'plain'> {
  readonly id = 'plain' as const;
  readonly name = 'Plain Processor';

  async processInputStep({ messageList }: ProcessInputStepArgs) {
    return { messageList };
  }
}

/**
 * Runs in two phases that mean different things, the way the observational
 * memory processor recalls on the input step and saves on the output result.
 */
const PHASE_OPERATION: Partial<Record<ProcessorSpanPhase, 'recall' | 'save'>> = {
  inputStep: 'recall',
  output: 'save',
  outputStep: 'save',
};

class TwoPhaseProcessor implements Processor<'two-phase'> {
  readonly id = 'two-phase' as const;
  readonly name = 'Two Phase Processor';
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = (phase: ProcessorSpanPhase) => `memory: ${PHASE_OPERATION[phase] ?? 'other'}`;
  readonly spanAttributes = (phase: ProcessorSpanPhase) => {
    const operationType = PHASE_OPERATION[phase];
    return operationType ? { operationType } : {};
  };

  async processInputStep({ messageList }: ProcessInputStepArgs) {
    return { messageList };
  }
  async processOutputResult({ messageList }: ProcessOutputResultArgs) {
    return messageList;
  }
}

/**
 * Implements every processor method that produces a span, so a run covers each
 * phase rather than only the two the built-in processors happen to use. The
 * name encodes the phase, which is what lets a test assert that no phase
 * silently fell back to the default label.
 */
class AllPhasesProcessor implements Processor<'all-phases'> {
  readonly id = 'all-phases' as const;
  readonly name = 'All Phases Processor';
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = (phase: ProcessorSpanPhase) => `phase:${phase}`;
  readonly spanAttributes = { operationType: 'recall' } as const;

  async processInput({ messages }: ProcessInputArgs) {
    return messages;
  }
  async processInputStep({ messageList }: ProcessInputStepArgs) {
    return { messageList };
  }
  async processOutputStream({ part }: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    return part;
  }
  async processOutputStep({ messageList }: ProcessOutputStepArgs) {
    return messageList;
  }
  async processOutputResult({ messageList }: ProcessOutputResultArgs) {
    return messageList;
  }
}

/**
 * Projects a value onto the state-signal lane. `emitOnStep` controls which steps
 * produce a signal so the "no change, no event" path is exercised too.
 */
class TestStateProcessor implements Processor<'test-state'> {
  readonly id = 'test-state' as const;
  readonly name = 'Test State Processor';
  readonly stateId = 'test-state-lane';

  /** tracingContext the runner handed to computeStateSignal, for the plumbing assertion. */
  sawTracingContextSpan: boolean | undefined;

  constructor(private readonly emit: boolean) {}

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    this.sawTracingContextSpan = Boolean(args.tracingContext?.currentSpan);
    if (!this.emit) return;
    return {
      id: this.stateId,
      cacheKey: 'v1',
      mode: 'snapshot',
      tagName: 'test-state',
      contents: '\nitem-1\n',
      value: { items: ['item-1'] },
      attributes: { count: 1 },
    };
  }
}

async function runAgent(processors: Processor[], opts: { memory?: boolean } = {}) {
  const agent = new Agent({
    id: 'span-type-agent',
    name: 'Span Type Agent',
    instructions: 'Test',
    model: createMockModel(),
    ...(opts.memory ? { memory: new MockMemory() } : {}),
    inputProcessors: processors,
    outputProcessors: processors.filter(p => 'processOutputResult' in p),
  });

  const mastra = new Mastra({ ...baseConfig(), agents: { agent } });
  await mastra.getAgent('agent').generate('Hello', {
    ...(opts.memory ? { memory: { thread: 'thread-1', resource: 'resource-1' } } : {}),
  });
}

/** Streams a run so `processOutputStream` executes, and drains the stream. */
async function streamAgent(processors: Processor[]) {
  const agent = new Agent({
    id: 'span-type-agent',
    name: 'Span Type Agent',
    instructions: 'Test',
    model: createMockModel(),
    inputProcessors: processors,
    outputProcessors: processors,
  });

  const mastra = new Mastra({ ...baseConfig(), agents: { agent } });
  const result = await mastra.getAgent('agent').stream('Hello');
  for await (const _chunk of result.fullStream) {
    // drain
  }
}

describe('processor-declared span types', () => {
  beforeEach(() => {
    exporter = new SpanCollector();
  });
  afterEach(async () => {
    if (observability) await observability.shutdown();
  });

  it('uses the declared type and name, and still records the pipeline attributes', async () => {
    await runAgent([new DeclaringProcessor()]);

    const spans = exporter.byName('skill:inject');
    expect(spans).toHaveLength(1);
    const span = spans[0]!;

    // Declared identity.
    expect(span.type).toBe(SpanType.SKILL_ACTION);
    expect((span.attributes as any)?.operation).toBe('inject');

    // The runner's facts survive retyping — this is what keeps the span usable
    // for "where in the pipeline did this run".
    expect(span.entityType).toBe(EntityType.INPUT_STEP_PROCESSOR);
    expect(span.entityId).toBe('declaring');
    expect((span.attributes as any)?.processorExecutor).toBeDefined();
    expect((span.attributes as any)?.processorIndex).toBe(0);

    // The default label must be gone, not merely supplemented.
    expect(exporter.names()).not.toContain('input step processor: declaring');
  });

  it('does not let a declaration overwrite the runner-owned pipeline facts', async () => {
    await runAgent([new OverreachingProcessor()]);

    const spans = exporter.byName('skill:overreach');
    expect(spans).toHaveLength(1);
    const attributes = spans[0]!.attributes as any;

    // The declared domain attribute is kept...
    expect(attributes?.operation).toBe('inject');
    // ...but the runner's own facts win over the declared ones. The
    // declaration claimed index 99 and the legacy executor; this processor is
    // first in the chain and runs on the workflow executor.
    expect(attributes?.processorIndex).toBe(0);
    expect(attributes?.processorExecutor).toBe('workflow');
  });

  it('leaves no phase of a declaring processor on the default span type', async () => {
    // The general invariant behind the individual phase tests: whichever
    // methods a processor implements, none of its spans may fall back.
    await streamAgent([new AllPhasesProcessor()]);

    const mine = exporter.ended.filter(
      span => span.entityId === 'all-phases' || span.entityName === 'All Phases Processor',
    );

    expect(mine.length).toBeGreaterThan(0);
    for (const span of mine) {
      expect(span.type).toBe(SpanType.MEMORY_OPERATION);
      expect(span.name).toMatch(/^phase:/);
      expect((span.attributes as any)?.operationType).toBe('recall');
      // The runner's own facts still survive the retyping.
      expect((span.attributes as any)?.processorExecutor).toBeDefined();
    }

    // Every phase this processor implements is represented, so the assertion
    // above cannot pass by covering only one of them.
    const phases = new Set(mine.map(span => span.name));
    expect(phases.size).toBeGreaterThan(1);
  });

  it('leaves a processor that declares nothing on PROCESSOR_RUN', async () => {
    await runAgent([new PlainProcessor()]);

    const spans = exporter.byName('input step processor: plain');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.type).toBe(SpanType.PROCESSOR_RUN);
  });

  it('names and describes each phase separately when given a function', async () => {
    await runAgent([new TwoPhaseProcessor()]);

    const recall = exporter.byName('memory: recall');
    const save = exporter.byName('memory: save');

    expect(recall.length).toBeGreaterThan(0);
    expect(save.length).toBeGreaterThan(0);

    expect(recall[0]!.type).toBe(SpanType.MEMORY_OPERATION);
    expect((recall[0]!.attributes as any)?.operationType).toBe('recall');
    expect(recall[0]!.entityType).toBe(EntityType.INPUT_STEP_PROCESSOR);

    expect(save[0]!.type).toBe(SpanType.MEMORY_OPERATION);
    expect((save[0]!.attributes as any)?.operationType).toBe('save');
  });
});

describe('state signal emissions', () => {
  beforeEach(() => {
    exporter = new SpanCollector();
  });
  afterEach(async () => {
    if (observability) await observability.shutdown();
  });

  it('records an AGENT_SIGNAL event when a signal is emitted', async () => {
    const processor = new TestStateProcessor(true);
    await runAgent([processor], { memory: true });

    const signals = exporter.byType(SpanType.AGENT_SIGNAL);
    expect(signals.length).toBeGreaterThan(0);

    const signal = signals[0]!;
    expect(signal.isEvent).toBe(true);
    expect(signal.name).toBe('signal: test-state-lane');
    expect((signal.attributes as any)?.stateId).toBe('test-state-lane');
    expect((signal.attributes as any)?.mode).toBe('snapshot');
    expect((signal.attributes as any)?.processorId).toBe('test-state');
  });

  it('records nothing when the lane computes no change', async () => {
    const processor = new TestStateProcessor(false);
    await runAgent([processor], { memory: true });

    expect(exporter.byType(SpanType.AGENT_SIGNAL)).toHaveLength(0);
    // The processor still ran — it is the emission that is conditional.
    expect(processor.sawTracingContextSpan).toBeDefined();
  });

  it('hands computeStateSignal a real tracing context', async () => {
    // `ComputeStateSignalArgs` always advertised `tracingContext`, but the
    // runner never passed one, leaving it undefined for every implementer.
    const processor = new TestStateProcessor(true);
    await runAgent([processor], { memory: true });

    expect(processor.sawTracingContextSpan).toBe(true);
  });
});

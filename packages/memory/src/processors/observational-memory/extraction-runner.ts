import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

import { omDebug, omError } from './debug';
import type { Extractor } from './extractor';
import { buildExtractorPriorLines } from './extractor';
import type { ModelByInputTokens } from './model-by-input-tokens';
import { buildObserverHistoryMessage } from './observer-agent';
import { withRetry } from './retry';
import type { TokenCounter } from './token-counter';
import { withOmTracingSpan } from './tracing';
import type { ResolvedObservationConfig } from './types';

type ConcreteObservationModel = Exclude<ResolvedObservationConfig['model'], ModelByInputTokens>;

type ExtractionModelResolver = (inputTokens: number) => {
  model: ConcreteObservationModel;
  selectedThreshold?: number;
  routingStrategy?: 'model-by-input-tokens';
  routingThresholds?: string;
};

export interface ObservationExtractionSession {
  agent: Agent;
  threadId: string;
  resourceId: string;
}

export interface ExtractionSnapshot {
  recordId?: string;
  cycleId: string;
  threadId: string;
  resourceId?: string;
  observedMessages: MastraDBMessage[];
  activeObservations: string;
  newObservations: string;
  previousExtractedValues?: Readonly<Record<string, unknown>>;
  extractionSession?: ObservationExtractionSession;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function buildExtractionSchema(extractors: ReadonlyArray<Extractor<any>>) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const extractor of extractors) {
    shape[extractor.slug] = (extractor.schema as z.ZodTypeAny).optional();
  }
  return z.object({ values: z.object(shape).partial().default({}) });
}

function buildExtractionPrompt(snapshot: ExtractionSnapshot, extractors: ReadonlyArray<Extractor<any>>): string {
  const extractorSpecs = extractors
    .map(extractor => {
      const prior = buildExtractorPriorLines([extractor], snapshot.previousExtractedValues).join('\n');
      return [
        `### ${extractor.slug}`,
        `Name: ${extractor.name}`,
        'Instructions:',
        extractor.instructions,
        prior ? `Prior value:\n${prior}` : undefined,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return [
    'Now run the Observational Memory extraction pass for the observer result you just produced.',
    'Extract only the requested structured values from the same observer conversation and the concrete observation-cycle snapshot below.',
    'Use the persisted observations from the prior assistant turn, the message history already in this thread, and the snapshot fields as evidence.',
    'Return a structured object with a `values` object keyed by extractor slug.',
    'Omit a slug when there is not enough evidence for that extractor in this snapshot.',
    '',
    '## Extraction Targets',
    extractorSpecs,
    '',
    '## Snapshot',
    `Record ID: ${snapshot.recordId ?? '(unknown)'}`,
    `Cycle ID: ${snapshot.cycleId}`,
    `Thread ID: ${snapshot.threadId}`,
    snapshot.resourceId ? `Resource ID: ${snapshot.resourceId}` : undefined,
    '',
    '## Active Observations Before This Cycle',
    snapshot.activeObservations || '(none)',
    '',
    '## Newly Persisted Observations From This Cycle',
    snapshot.newObservations || '(none)',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Runs the structured extraction pass after observations have already persisted. */
export class ExtractionRunner {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly resolveModel: ExtractionModelResolver;
  private readonly tokenCounter: TokenCounter;
  private mastra?: Mastra;

  constructor(opts: {
    observationConfig: ResolvedObservationConfig;
    resolveModel: ExtractionModelResolver;
    tokenCounter: TokenCounter;
    mastra?: Mastra;
  }) {
    this.observationConfig = opts.observationConfig;
    this.resolveModel = opts.resolveModel;
    this.tokenCounter = opts.tokenCounter;
    this.mastra = opts.mastra;
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  private createAgent(model: ConcreteObservationModel): Agent {
    const agent = new Agent({
      id: 'observational-memory-extractor',
      name: 'Observational Memory Extractor',
      instructions: 'You extract typed values from an already-persisted Observational Memory snapshot.',
      model,
    });
    if (this.mastra) {
      agent.__registerMastra(this.mastra);
    }
    return agent;
  }

  async call(
    snapshot: ExtractionSnapshot,
    extractors: ReadonlyArray<Extractor<any>>,
    abortSignal?: AbortSignal,
    options?: {
      requestContext?: RequestContext;
      observabilityContext?: ObservabilityContext;
      model?: ConcreteObservationModel;
    },
  ): Promise<{
    extractedValues?: Record<string, unknown>;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    if (extractors.length === 0) return {};

    const inputTokens = this.tokenCounter.countMessages(snapshot.observedMessages);
    const resolvedModel = options?.model ? { model: options.model } : this.resolveModel(inputTokens);
    const session = snapshot.extractionSession;
    const agent = session?.agent ?? this.createAgent(resolvedModel.model);
    const schema = buildExtractionSchema(extractors);
    const extractionMessages: CoreMessage[] = session
      ? [{ role: 'user', content: buildExtractionPrompt(snapshot, extractors) }]
      : [
          { role: 'user', content: buildExtractionPrompt(snapshot, extractors) },
          buildObserverHistoryMessage(snapshot.observedMessages),
        ];

    const object = await withRetry(
      () =>
        withOmTracingSpan({
          phase: 'extractor',
          model: resolvedModel.model,
          inputTokens,
          requestContext: options?.requestContext,
          observabilityContext: options?.observabilityContext,
          metadata: {
            omExtractorCount: extractors.length,
            ...(resolvedModel.selectedThreshold !== undefined
              ? { omSelectedThreshold: resolvedModel.selectedThreshold }
              : {}),
            ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
            ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
          },
          callback: async childObservabilityContext => {
            const stream = await agent.stream(extractionMessages, {
              ...(session ? { memory: { thread: session.threadId, resource: session.resourceId } } : {}),
              structuredOutput: { schema },
              modelSettings: { ...this.observationConfig.modelSettings },
              providerOptions: this.observationConfig.providerOptions as any,
              ...(abortSignal ? { abortSignal } : {}),
              ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
              ...childObservabilityContext,
            });
            return stream.object;
          },
        }),
      { label: 'extractor', abortSignal },
    );
    const rawValues = isPlainRecord(object) && isPlainRecord(object.values) ? object.values : {};
    const extractedValues: Record<string, unknown> = {};

    for (const extractor of extractors) {
      if (!(extractor.slug in rawValues)) continue;
      const parsed = extractor.schema.safeParse(rawValues[extractor.slug]);
      if (parsed.success) {
        extractedValues[extractor.slug] = parsed.data;
      } else {
        omError(`[OM] structured extractor value failed validation (${extractor.slug})`, parsed.error);
      }
    }

    if (Object.keys(extractedValues).length === 0) {
      omDebug(`[OM] structured extraction produced no values for cycle ${snapshot.cycleId}`);
    }

    return {
      extractedValues: Object.keys(extractedValues).length > 0 ? extractedValues : undefined,
    };
  }
}

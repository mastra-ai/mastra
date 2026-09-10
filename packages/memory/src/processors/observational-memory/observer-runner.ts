import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { modelSupportsAttachments } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorContext } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ProviderMetadata } from '@mastra/core/stream';

import type { Memory } from '../..';
import { omDebug } from './debug';
import { getBuiltInExtractedValues, mergeExtractedValues, mergeExtractionFailures } from './extracted-values';
import { extractStructuredValues } from './extraction-runner';
import type { Extractor } from './extractor';
import { resolveExtractors } from './extractor';
import { withOmInternalThreadId } from './internal-request-context';
import type { ModelByInputTokens } from './model-by-input-tokens';
import type { ObserverAttachmentFilter } from './observer-agent';
import {
  buildObserverSystemPrompt,
  buildObserverTaskPrompt,
  buildObserverHistoryMessage,
  buildMultiThreadObserverTaskPrompt,
  buildMultiThreadObserverHistoryMessage,
  parseObserverOutput,
  parseMultiThreadObserverOutput,
  describeDegenerateOutput,
} from './observer-agent';
import { withRetry } from './retry';
import { createTemporaryOmMemoryContext } from './temporary-memory';
import type { TokenCounter } from './token-counter';
import { withOmTracingSpan } from './tracing';
import { applyBeforeObservation, applyTextTransform } from './transform-hooks';
import type { ObserveTransformHooks, ObserveTrigger, ResolvedObservationConfig } from './types';

type ConcreteObservationModel = Exclude<ResolvedObservationConfig['model'], ModelByInputTokens>;

type ObservationModelResolver = (inputTokens: number) => {
  model: ConcreteObservationModel;
  selectedThreshold?: number;
  routingStrategy?: 'model-by-input-tokens';
  routingThresholds?: string;
};

/**
 * Runs the Observer agent for extracting observations from messages.
 * Handles single-thread and multi-thread modes, degenerate detection, and retry logic.
 */
export interface ObserverExchange {
  systemPrompt: string;
  observerMessages: Array<{ role: string; content: unknown }>;
  rawOutput: string;
  parsedResult: {
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    extractedValues?: Record<string, unknown>;
    extractionFailures?: Array<{ slug: string; error: string }>;
    degenerate?: boolean;
  };
  model: string;
  inputTokens: number;
  isMultiThread: boolean;
  retriedDueToDegenerate: boolean;
}

interface ObserverCallOptions {
  skipContinuationHints?: boolean;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
  priorCurrentTask?: string;
  priorSuggestedResponse?: string;
  priorThreadTitle?: string;
  priorExtractedValues?: Record<string, unknown>;
  wasTruncated?: boolean;
  model?: ConcreteObservationModel;
  threadId?: string;
  resourceId?: string;
  /** Which pipeline path initiated this cycle; passed to transform hooks. */
  trigger?: ObserveTrigger;
  mainAgent?: ProcessorContext['agent'];
}

interface ObserverCallResult {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  extractors?: readonly Extractor<any>[];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  providerMetadata?: ProviderMetadata;
}

interface MultiThreadObserverResult {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  threadTitle?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  extractors?: readonly Extractor<any>[];
}

function filterObserverExtractors(
  extractors: ResolvedObservationConfig['extractors'] | undefined,
  skipContinuationHints?: boolean,
) {
  const configuredExtractors = extractors ?? [];
  if (!skipContinuationHints) {
    return configuredExtractors;
  }
  return configuredExtractors.filter(
    extractor => extractor.slug !== 'current-task' && extractor.slug !== 'suggested-response',
  );
}

export class ObserverRunner {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly observedMessageIds: Set<string>;
  private readonly resolveModel: ObservationModelResolver;
  private readonly tokenCounter: TokenCounter;
  private readonly memory?: Memory;
  private readonly hooks?: ObserveTransformHooks;
  private mastra?: Mastra;

  /** Captured prompt/response from the last observer call (for repro capture). */
  lastExchange?: ObserverExchange;

  constructor(opts: {
    observationConfig: ResolvedObservationConfig;
    observedMessageIds: Set<string>;
    resolveModel: ObservationModelResolver;
    tokenCounter: TokenCounter;
    mastra?: Mastra;
    memory?: Memory;
    hooks?: ObserveTransformHooks;
  }) {
    this.observationConfig = opts.observationConfig;
    this.observedMessageIds = opts.observedMessageIds;
    this.resolveModel = opts.resolveModel;
    this.tokenCounter = opts.tokenCounter;
    this.mastra = opts.mastra;
    this.memory = opts.memory;
    this.hooks = opts.hooks;
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  private createAgent(
    model: ConcreteObservationModel,
    isMultiThread = false,
    memory?: MastraMemory,
    extractors = this.observationConfig.extractors ?? [],
  ): Agent {
    const agent = new Agent({
      id: isMultiThread ? 'multi-thread-observer' : 'observational-memory-observer',
      name: isMultiThread ? 'multi-thread-observer' : 'Observer',
      instructions: buildObserverSystemPrompt(
        isMultiThread,
        this.observationConfig.instruction,
        this.observationConfig.threadTitle,
        extractors,
      ),
      model,
      ...(memory ? { memory } : {}),
    });
    if (this.mastra) {
      agent.__registerMastra(this.mastra);
    }
    return agent;
  }

  /**
   * Extract a router-style model ID (`provider/model`) from a model config.
   * Handles strings, LanguageModel objects, and function-based models.
   */
  private extractModelRouterId(model: ConcreteObservationModel, requestContext?: RequestContext): string | undefined {
    if (typeof model === 'string') return model;

    // Function-based model — resolve it with requestContext to get the actual model
    if (typeof model === 'function') {
      if (!requestContext) return undefined;
      try {
        const resolved = model({ requestContext });
        // Recursion handles the resolved value (string or LanguageModel object)
        if (resolved instanceof Promise) return undefined; // can't await in sync context
        return this.extractModelRouterId(resolved as ConcreteObservationModel);
      } catch {
        return undefined;
      }
    }

    // LanguageModel object — check for provider/modelId properties
    const obj = model as Record<string, unknown>;
    if (typeof obj.provider === 'string' && typeof obj.modelId === 'string') {
      return `${obj.provider}/${obj.modelId}`;
    }

    return undefined;
  }

  /**
   * Resolve the attachment filter for a given model. When set to `'auto'`,
   * the provider capabilities registry is consulted to decide whether the
   * model accepts multimodal input.
   */
  private resolveAttachmentFilter(
    model: ConcreteObservationModel,
    requestContext?: RequestContext,
  ): ObserverAttachmentFilter {
    const raw = this.observationConfig.observeAttachments;
    if (raw !== 'auto') return raw;

    const routerId = this.extractModelRouterId(model, requestContext);
    if (!routerId) return true; // can't determine — default to forwarding
    const supports = modelSupportsAttachments(routerId);
    return supports ?? true;
  }

  private async withAbortCheck<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }
    const result = await fn();
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }
    return result;
  }

  /**
   * Call the Observer agent for a single thread, running the config-level
   * `beforeObservation` / `afterObservation` transform hooks around it.
   */
  async call(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: ObserverCallOptions,
  ): Promise<ObserverCallResult> {
    const context = {
      threadId: options?.threadId ?? messagesToObserve[0]?.threadId,
      resourceId: options?.resourceId,
      trigger: options?.trigger,
    };
    const messages = await applyBeforeObservation(this.hooks, messagesToObserve, context);
    if (messages.length === 0) {
      omDebug('[OM:callObserver] beforeObservation returned no messages, skipping observer call');
      return { observations: '' };
    }
    const result = await this.callObserver(existingObservations, messages, abortSignal, options);
    result.observations = await applyTextTransform(this.hooks, 'afterObservation', result.observations, context);
    return result;
  }

  private async callObserver(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: ObserverCallOptions,
  ): Promise<ObserverCallResult> {
    const inputTokens = this.tokenCounter.countMessages(messagesToObserve);
    const resolvedModel = options?.model ? { model: options.model } : this.resolveModel(inputTokens);
    const activeExtractors = await resolveExtractors(
      filterObserverExtractors(this.observationConfig.extractors, options?.skipContinuationHints),
      {
        source: 'observer',
        threadId: messagesToObserve[0]?.threadId,
        resourceId: options?.resourceId,
        mainAgent: options?.mainAgent,
        memory: this.memory,
        requestContext: options?.requestContext,
      },
    );
    const structuredExtractors = activeExtractors.filter(extractor => extractor.mode === 'structured');
    const temporaryMemory =
      structuredExtractors.length > 0 ? await createTemporaryOmMemoryContext('structured-observer') : undefined;
    const agent = temporaryMemory
      ? this.createAgent(resolvedModel.model, false, temporaryMemory.memory, activeExtractors)
      : this.createAgent(resolvedModel.model, false, undefined, activeExtractors);
    const internalRequestContext = withOmInternalThreadId(options?.requestContext, agent.id);

    const attachmentFilter = this.resolveAttachmentFilter(resolvedModel.model, options?.requestContext);

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildObserverTaskPrompt(existingObservations, {
          ...options,
          includeThreadTitle: this.observationConfig.threadTitle,
          extractors: activeExtractors,
        }),
      },
      buildObserverHistoryMessage(messagesToObserve, {
        attachmentFilter,
      }),
    ];

    const doGenerate = async () => {
      return withRetry(
        () =>
          withOmTracingSpan({
            phase: 'observer',
            model: resolvedModel.model,
            inputTokens,
            requestContext: options?.requestContext,
            observabilityContext: options?.observabilityContext,
            metadata: {
              omPreviousObserverTokens: this.observationConfig.previousObserverTokens,
              omThreadTitleEnabled: this.observationConfig.threadTitle,
              omSkipContinuationHints: options?.skipContinuationHints ?? false,
              omWasTruncated: options?.wasTruncated ?? false,
              ...(resolvedModel.selectedThreshold !== undefined
                ? { omSelectedThreshold: resolvedModel.selectedThreshold }
                : {}),
              ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
              ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
            },
            callback: childObservabilityContext =>
              this.withAbortCheck(async () => {
                const streamResult = await agent.stream(observerMessages, {
                  modelSettings: { ...this.observationConfig.modelSettings },
                  providerOptions: this.observationConfig.providerOptions as any,
                  ...(temporaryMemory ? { memory: temporaryMemory.options } : {}),
                  ...(abortSignal ? { abortSignal } : {}),
                  ...(internalRequestContext ? { requestContext: internalRequestContext } : {}),
                  ...childObservabilityContext,
                });
                return streamResult.getFullOutput();
              }, abortSignal),
          }),
        { label: 'observer', abortSignal },
      );
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text, activeExtractors);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(
        `[OM:callObserver] degenerate repetition detected, retrying once. ${describeDegenerateOutput(result.text, 2000)}`,
      );
      result = await doGenerate();
      parsed = parseObserverOutput(result.text, activeExtractors);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(
          `[OM:callObserver] degenerate repetition on retry, failing. ${describeDegenerateOutput(result.text, 2000)}`,
        );
        throw new Error(`Observer produced degenerate output after retry. ${describeDegenerateOutput(result.text)}`);
      }
    }

    const structuredExtraction = await extractStructuredValues({
      agent,
      source: 'observer',
      extractors: activeExtractors,
      memory: temporaryMemory?.options,
      priorExtractedValues: options?.priorExtractedValues,
      requestContext: internalRequestContext,
      observabilityContext: options?.observabilityContext,
      abortSignal,
    });
    const extractedValues = mergeExtractedValues(parsed.extractedValues, structuredExtraction.values);
    const extractionFailures = mergeExtractionFailures(parsed.extractionFailures, structuredExtraction.failures);
    const builtIns = getBuiltInExtractedValues(extractedValues);

    const systemPrompt = buildObserverSystemPrompt(
      false,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
      activeExtractors,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: parsed.observations,
        currentTask: builtIns.currentTask ?? parsed.currentTask,
        suggestedContinuation: builtIns.suggestedContinuation ?? parsed.suggestedContinuation,
        threadTitle: builtIns.threadTitle ?? parsed.threadTitle,
        extractedValues,
        extractionFailures,
        degenerate: parsed.degenerate,
      },
      model: String(resolvedModel.model),
      inputTokens,
      isMultiThread: false,
      retriedDueToDegenerate,
    };

    const usage = result.totalUsage ?? result.usage;

    return {
      observations: parsed.observations,
      currentTask: builtIns.currentTask ?? parsed.currentTask,
      suggestedContinuation: builtIns.suggestedContinuation ?? parsed.suggestedContinuation,
      threadTitle: builtIns.threadTitle ?? parsed.threadTitle,
      extractedValues,
      extractionFailures,
      extractors: activeExtractors,
      usage: usage
        ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
        : undefined,
      providerMetadata: result.providerMetadata,
    };
  }

  /**
   * Call the Observer agent for multiple threads in a single batched request.
   */
  async callMultiThread(
    existingObservations: string | undefined,
    allMessagesByThread: Map<string, MastraDBMessage[]>,
    allThreadOrder: string[],
    abortSignal?: AbortSignal,
    requestContext?: RequestContext,
    priorMetadataByThread?: Map<
      string,
      { currentTask?: string; suggestedResponse?: string; threadTitle?: string; extracted?: Record<string, unknown> }
    >,
    observabilityContext?: ObservabilityContext,
    model?: ConcreteObservationModel,
    hookContext?: { resourceId?: string; trigger?: ObserveTrigger },
  ): Promise<{
    results: Map<string, MultiThreadObserverResult>;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    providerMetadata?: ProviderMetadata;
  }> {
    const contextFor = (threadId: string) => ({ threadId, ...hookContext });

    // Apply beforeObservation per thread; threads left with no messages are
    // excluded from the observer call but still get an empty result.
    const messagesByThread = new Map<string, MastraDBMessage[]>();
    for (const threadId of allThreadOrder) {
      const filtered = await applyBeforeObservation(
        this.hooks,
        allMessagesByThread.get(threadId) ?? [],
        contextFor(threadId),
      );
      if (filtered.length > 0) messagesByThread.set(threadId, filtered);
    }
    const threadOrder = allThreadOrder.filter(threadId => messagesByThread.has(threadId));

    const output = await this.callMultiThreadObserver(
      existingObservations,
      messagesByThread,
      threadOrder,
      abortSignal,
      requestContext,
      priorMetadataByThread,
      observabilityContext,
      model,
    );

    for (const threadId of allThreadOrder) {
      const threadResult = output.results.get(threadId);
      if (!threadResult) {
        output.results.set(threadId, { observations: '' });
        continue;
      }
      threadResult.observations = await applyTextTransform(
        this.hooks,
        'afterObservation',
        threadResult.observations,
        contextFor(threadId),
      );
    }

    return output;
  }

  private async callMultiThreadObserver(
    existingObservations: string | undefined,
    messagesByThread: Map<string, MastraDBMessage[]>,
    threadOrder: string[],
    abortSignal?: AbortSignal,
    requestContext?: RequestContext,
    priorMetadataByThread?: Map<
      string,
      { currentTask?: string; suggestedResponse?: string; threadTitle?: string; extracted?: Record<string, unknown> }
    >,
    observabilityContext?: ObservabilityContext,
    model?: ConcreteObservationModel,
  ): Promise<{
    results: Map<string, MultiThreadObserverResult>;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    providerMetadata?: ProviderMetadata;
  }> {
    if (threadOrder.length === 0) {
      return { results: new Map() };
    }

    const inputTokens = Array.from(messagesByThread.values()).reduce(
      (total, messages) => total + this.tokenCounter.countMessages(messages),
      0,
    );
    const resolvedModel = model ? { model } : this.resolveModel(inputTokens);
    const firstThreadMessages = messagesByThread.get(threadOrder[0] ?? '') ?? [];
    const activeExtractors = await resolveExtractors(this.observationConfig.extractors ?? [], {
      source: 'observer',
      threadId: threadOrder[0],
      resourceId: firstThreadMessages[0]?.resourceId,
      memory: this.memory,
      requestContext,
    });
    const structuredExtractors = activeExtractors.filter(extractor => extractor.mode === 'structured');

    if (structuredExtractors.length > 0) {
      const results = new Map<string, MultiThreadObserverResult>();
      let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      for (const threadId of threadOrder) {
        const threadResult = await this.callObserver(
          existingObservations,
          messagesByThread.get(threadId) ?? [],
          abortSignal,
          {
            requestContext,
            observabilityContext,
            priorCurrentTask: priorMetadataByThread?.get(threadId)?.currentTask,
            priorSuggestedResponse: priorMetadataByThread?.get(threadId)?.suggestedResponse,
            priorThreadTitle: priorMetadataByThread?.get(threadId)?.threadTitle,
            priorExtractedValues: priorMetadataByThread?.get(threadId)?.extracted,
            model: resolvedModel.model,
          },
        );
        results.set(threadId, {
          observations: threadResult.observations,
          currentTask: threadResult.currentTask,
          suggestedContinuation: threadResult.suggestedContinuation,
          threadTitle: threadResult.threadTitle,
          extractedValues: threadResult.extractedValues,
          extractionFailures: threadResult.extractionFailures,
          extractors: threadResult.extractors,
        });
        if (threadResult.usage) {
          totalUsage.inputTokens += threadResult.usage.inputTokens ?? 0;
          totalUsage.outputTokens += threadResult.usage.outputTokens ?? 0;
          totalUsage.totalTokens += threadResult.usage.totalTokens ?? 0;
        }
      }
      return { results, usage: totalUsage };
    }

    let temporaryMemory: Awaited<ReturnType<typeof createTemporaryOmMemoryContext>> | undefined;
    const agent = this.createAgent(resolvedModel.model, true, undefined, activeExtractors);
    const internalRequestContext = withOmInternalThreadId(requestContext, agent.id);

    const multiThreadAttachmentFilter = this.resolveAttachmentFilter(resolvedModel.model, requestContext);

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildMultiThreadObserverTaskPrompt(
          existingObservations,
          threadOrder,
          priorMetadataByThread,
          undefined,
          this.observationConfig.threadTitle,
          activeExtractors,
        ),
      },
      buildMultiThreadObserverHistoryMessage(messagesByThread, threadOrder, {
        attachmentFilter: multiThreadAttachmentFilter,
      }),
    ];

    // Mark all messages as observed
    for (const msgs of messagesByThread.values()) {
      for (const msg of msgs) {
        this.observedMessageIds.add(msg.id);
      }
    }

    const doGenerate = async () => {
      return withRetry(
        () =>
          withOmTracingSpan({
            phase: 'observer-multi-thread',
            model: resolvedModel.model,
            inputTokens,
            requestContext,
            observabilityContext,
            metadata: {
              omThreadCount: threadOrder.length,
              omPreviousObserverTokens: this.observationConfig.previousObserverTokens,
              omThreadTitleEnabled: this.observationConfig.threadTitle,
              ...(resolvedModel.selectedThreshold !== undefined
                ? { omSelectedThreshold: resolvedModel.selectedThreshold }
                : {}),
              ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
              ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
            },
            callback: childObservabilityContext =>
              this.withAbortCheck(async () => {
                const streamResult = await agent.stream(observerMessages, {
                  modelSettings: { ...this.observationConfig.modelSettings },
                  providerOptions: this.observationConfig.providerOptions as any,
                  ...(temporaryMemory ? { memory: temporaryMemory.options } : {}),
                  ...(abortSignal ? { abortSignal } : {}),
                  ...(internalRequestContext ? { requestContext: internalRequestContext } : {}),
                  ...childObservabilityContext,
                });
                return streamResult.getFullOutput();
              }, abortSignal),
          }),
        { label: 'observer-multi-thread', abortSignal },
      );
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text, activeExtractors);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(
        `[OM:callMultiThreadObserver] degenerate repetition detected, retrying once. ${describeDegenerateOutput(result.text, 2000)}`,
      );
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text, activeExtractors);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(
          `[OM:callMultiThreadObserver] degenerate repetition on retry, failing. ${describeDegenerateOutput(result.text, 2000)}`,
        );
        throw new Error(
          `Multi-thread observer produced degenerate output after retry. ${describeDegenerateOutput(result.text)}`,
        );
      }
    }

    const structuredExtractionByThread = new Map<string, Awaited<ReturnType<typeof extractStructuredValues>>>();

    const aggregatedExtractedValues = mergeExtractedValues(
      ...Array.from(parsed.threads, ([threadId, threadResult]) =>
        mergeExtractedValues(threadResult.extractedValues, structuredExtractionByThread.get(threadId)?.values),
      ),
    );
    const aggregatedExtractionFailures = mergeExtractionFailures(
      ...Array.from(parsed.threads, ([threadId, threadResult]) =>
        mergeExtractionFailures(threadResult.extractionFailures, structuredExtractionByThread.get(threadId)?.failures),
      ),
    );
    const aggregatedBuiltIns = getBuiltInExtractedValues(aggregatedExtractedValues);
    const systemPrompt = buildObserverSystemPrompt(
      true,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
      activeExtractors,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: Array.from(parsed.threads.values())
          .map(t => t.observations)
          .join('\n'),
        currentTask: aggregatedBuiltIns.currentTask,
        suggestedContinuation: aggregatedBuiltIns.suggestedContinuation,
        threadTitle:
          aggregatedBuiltIns.threadTitle ??
          Array.from(parsed.threads.values())
            .map(t => t.threadTitle)
            .filter(Boolean)
            .join(', '),
        extractedValues: aggregatedExtractedValues,
        extractionFailures: aggregatedExtractionFailures,
        degenerate: parsed.degenerate,
      },
      model: String(resolvedModel.model),
      inputTokens,
      isMultiThread: true,
      retriedDueToDegenerate,
    };

    const results = new Map<string, MultiThreadObserverResult>();
    for (const [threadId, threadResult] of parsed.threads) {
      const structuredExtraction = structuredExtractionByThread.get(threadId);
      const extractedValues = mergeExtractedValues(threadResult.extractedValues, structuredExtraction?.values);
      const extractionFailures = mergeExtractionFailures(
        threadResult.extractionFailures,
        structuredExtraction?.failures,
      );
      const builtIns = getBuiltInExtractedValues(extractedValues);
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: builtIns.currentTask ?? threadResult.currentTask,
        suggestedContinuation: builtIns.suggestedContinuation ?? threadResult.suggestedContinuation,
        threadTitle: builtIns.threadTitle ?? threadResult.threadTitle,
        extractedValues,
        extractionFailures,
        extractors: activeExtractors,
      });
    }

    // Add empty results for threads that didn't get output
    for (const threadId of threadOrder) {
      if (!results.has(threadId)) {
        results.set(threadId, { observations: '' });
      }
    }

    const usage = result.totalUsage ?? result.usage;

    return {
      results,
      usage: usage
        ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
        : undefined,
      providerMetadata: result.providerMetadata,
    };
  }
}

import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { modelSupportsAttachments } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';

import { omDebug } from './debug';
import type { ObservationExtractionSession } from './extraction-runner';
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
} from './observer-agent';
import { withRetry } from './retry';
import type { TokenCounter } from './token-counter';
import { withOmTracingSpan } from './tracing';
import type { ResolvedObservationConfig } from './types';

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
    degenerate?: boolean;
  };
  model: string;
  inputTokens: number;
  isMultiThread: boolean;
  retriedDueToDegenerate: boolean;
}

export class ObserverRunner {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly observedMessageIds: Set<string>;
  private readonly resolveModel: ObservationModelResolver;
  private readonly tokenCounter: TokenCounter;
  private mastra?: Mastra;

  /** Captured prompt/response from the last observer call (for repro capture). */
  lastExchange?: ObserverExchange;

  constructor(opts: {
    observationConfig: ResolvedObservationConfig;
    observedMessageIds: Set<string>;
    resolveModel: ObservationModelResolver;
    tokenCounter: TokenCounter;
    mastra?: Mastra;
  }) {
    this.observationConfig = opts.observationConfig;
    this.observedMessageIds = opts.observedMessageIds;
    this.resolveModel = opts.resolveModel;
    this.tokenCounter = opts.tokenCounter;
    this.mastra = opts.mastra;
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  private createAgent(model: ConcreteObservationModel, isMultiThread = false): Agent {
    const agent = new Agent({
      id: isMultiThread ? 'multi-thread-observer' : 'observational-memory-observer',
      name: isMultiThread ? 'multi-thread-observer' : 'Observer',
      instructions: buildObserverSystemPrompt(
        isMultiThread,
        this.observationConfig.instruction,
        this.observationConfig.threadTitle,
      ),
      model,
      memory: new MockMemory({ options: { lastMessages: 20 } }),
    });
    if (this.mastra) {
      agent.__registerMastra(this.mastra);
    }
    return agent;
  }

  private createExtractionSession(agent: Agent, resourceId?: string): ObservationExtractionSession {
    return {
      agent,
      threadId: `om-observer-${randomUUID()}`,
      resourceId: resourceId ?? 'observational-memory',
    };
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
   * Call the Observer agent for a single thread.
   */
  async call(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: {
      skipContinuationHints?: boolean;
      requestContext?: RequestContext;
      observabilityContext?: ObservabilityContext;
      resourceId?: string;
      priorCurrentTask?: string;
      priorSuggestedResponse?: string;
      priorThreadTitle?: string;
      wasTruncated?: boolean;
      model?: ConcreteObservationModel;
    },
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    extractedValues?: Record<string, unknown>;
    extractionSession?: ObservationExtractionSession;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const inputTokens = this.tokenCounter.countMessages(messagesToObserve);
    const resolvedModel = options?.model ? { model: options.model } : this.resolveModel(inputTokens);
    const agent = this.createAgent(resolvedModel.model);
    const extractionSession = this.createExtractionSession(agent, options?.resourceId);

    const attachmentFilter = this.resolveAttachmentFilter(resolvedModel.model, options?.requestContext);

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildObserverTaskPrompt(existingObservations, {
          ...options,
          includeThreadTitle: this.observationConfig.threadTitle,
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
                  memory: { thread: extractionSession.threadId, resource: extractionSession.resourceId },
                  modelSettings: { ...this.observationConfig.modelSettings },
                  providerOptions: this.observationConfig.providerOptions as any,
                  ...(abortSignal ? { abortSignal } : {}),
                  ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
                  ...childObservabilityContext,
                });
                return streamResult.getFullOutput();
              }, abortSignal),
          }),
        { label: 'observer', abortSignal },
      );
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(`[OM:callObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseObserverOutput(result.text);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(`[OM:callObserver] degenerate repetition on retry, failing`);
        throw new Error('Observer produced degenerate output after retry');
      }
    }

    const systemPrompt = buildObserverSystemPrompt(
      false,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: parsed.observations,
        currentTask: parsed.currentTask,
        suggestedContinuation: parsed.suggestedContinuation,
        threadTitle: parsed.threadTitle,
        extractedValues: parsed.extractedValues,
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
      currentTask: parsed.currentTask,
      suggestedContinuation: parsed.suggestedContinuation,
      threadTitle: parsed.threadTitle,
      extractedValues: parsed.extractedValues,
      extractionSession,
      usage: usage
        ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
        : undefined,
    };
  }

  /**
   * Call the Observer agent for multiple threads in a single batched request.
   */
  async callMultiThread(
    existingObservations: string | undefined,
    messagesByThread: Map<string, MastraDBMessage[]>,
    threadOrder: string[],
    abortSignal?: AbortSignal,
    requestContext?: RequestContext,
    priorMetadataByThread?: Map<
      string,
      {
        currentTask?: string;
        suggestedResponse?: string;
        threadTitle?: string;
        extractedValues?: Readonly<Record<string, unknown>>;
      }
    >,
    observabilityContext?: ObservabilityContext,
    model?: ConcreteObservationModel,
    resourceId?: string,
  ): Promise<{
    results: Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
        threadTitle?: string;
        extractedValues?: Record<string, unknown>;
        extractionSession?: ObservationExtractionSession;
      }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const inputTokens = Array.from(messagesByThread.values()).reduce(
      (total, messages) => total + this.tokenCounter.countMessages(messages),
      0,
    );
    const resolvedModel = model ? { model } : this.resolveModel(inputTokens);
    const agent = this.createAgent(resolvedModel.model, true);
    const extractionSession = this.createExtractionSession(agent, resourceId);

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
                  memory: { thread: extractionSession.threadId, resource: extractionSession.resourceId },
                  modelSettings: { ...this.observationConfig.modelSettings },
                  providerOptions: this.observationConfig.providerOptions as any,
                  ...(abortSignal ? { abortSignal } : {}),
                  ...(requestContext ? { requestContext } : {}),
                  ...childObservabilityContext,
                });
                return streamResult.getFullOutput();
              }, abortSignal),
          }),
        { label: 'observer-multi-thread', abortSignal },
      );
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(`[OM:callMultiThreadObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(`[OM:callMultiThreadObserver] degenerate repetition on retry, failing`);
        throw new Error('Multi-thread observer produced degenerate output after retry');
      }
    }

    const systemPrompt = buildObserverSystemPrompt(
      true,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: Array.from(parsed.threads.values())
          .map(t => t.observations)
          .join('\n'),
        threadTitle: Array.from(parsed.threads.values())
          .map(t => t.threadTitle)
          .filter(Boolean)
          .join(', '),
        degenerate: parsed.degenerate,
      },
      model: String(resolvedModel.model),
      inputTokens,
      isMultiThread: true,
      retriedDueToDegenerate,
    };

    const results = new Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
        threadTitle?: string;
        extractedValues?: Record<string, unknown>;
        extractionSession?: ObservationExtractionSession;
      }
    >();
    for (const [threadId, threadResult] of parsed.threads) {
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: threadResult.currentTask,
        suggestedContinuation: threadResult.suggestedContinuation,
        threadTitle: threadResult.threadTitle,
        extractedValues: threadResult.extractedValues,
        extractionSession,
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
    };
  }
}

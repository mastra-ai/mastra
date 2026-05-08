import { Agent } from '@mastra/core/agent';
import type { MessageList } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import { BufferingCoordinator } from './buffering-coordinator';
import { omDebug, omError } from './debug';
import {
  createActivationMarker,
  createBufferingEndMarker,
  createBufferingFailedMarker,
  createBufferingStartMarker,
  createObservationEndMarker,
  createObservationFailedMarker,
  createObservationStartMarker,
} from './markers';
import type { ModelByInputTokens } from './model-by-input-tokens';
import { didProviderChange } from './model-context';
import { registerOp, unregisterOp, isOpActiveInProcess } from './operation-registry';
import {
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  MAX_COMPRESSION_LEVEL,
  parseReflectorOutput,
  validateCompression,
} from './reflector-agent';
import type { CompressionLevel } from './reflector-agent';
import { getMaxThreshold } from './thresholds';
import type { TokenCounter } from './token-counter';
import { withOmTracingSpan } from './tracing';
import type {
  ObservationDebugEvent,
  ObservationMarkerConfig,
  ObservationModelContext,
  ObserveHookUsage,
  ObserveHooks,
  ResolvedObservationConfig,
  ResolvedReflectionConfig,
  ThresholdRange,
} from './types';

function formatModelContext(provider?: string, modelId?: string): string | undefined {
  if (provider && modelId) {
    return `${provider}/${modelId}`;
  }

  return modelId;
}

function getCurrentModel(model?: ObservationModelContext): string | undefined {
  return formatModelContext(model?.provider, model?.modelId);
}

function getLastModelFromMessageList(messageList?: MessageList): string | undefined {
  const messages = messageList?.get.all.db();
  if (!messages) return undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'assistant' || !message.content || typeof message.content === 'string') {
      continue;
    }

    for (let j = message.content.parts.length - 1; j >= 0; j--) {
      const part = message.content.parts[j];
      if (part?.type === 'step-start' && typeof part.model === 'string' && part.model.length > 0) {
        return part.model;
      }
    }

    const metadata = message.content.metadata as { provider?: string; modelId?: string } | undefined;
    const model = formatModelContext(metadata?.provider, metadata?.modelId);
    if (model) {
      return model;
    }
  }

  return undefined;
}

type ConcreteReflectionModel = Exclude<ResolvedReflectionConfig['model'], ModelByInputTokens>;

type ReflectionModelResolver = (inputTokens: number) => {
  model: ConcreteReflectionModel;
  selectedThreshold?: number;
  routingStrategy?: 'model-by-input-tokens';
  routingThresholds?: string;
};

async function withAbortCheck<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
  if (abortSignal?.aborted) throw new Error('The operation was aborted.');
  const result = await fn();
  if (abortSignal?.aborted) throw new Error('The operation was aborted.');
  return result;
}

/**
 * Minimum size of combined (buffered reflection + unreflected tail) expressed
 * as a ratio of the regular threshold-activation target
 * (reflectThreshold × (1 − bufferActivation)). Early TTL / provider-change
 * triggers are suppressed if the post-activation size would fall below this
 * floor — keeps early activations close to the system's tuned post-activation
 * size while still letting them fire sooner than a threshold activation.
 */
const EARLY_ACTIVATION_SIZE_FLOOR_RATIO = 0.75;

/**
 * Result of an attempt to activate a buffered reflection. The caller uses
 * this to decide whether to fall through to sync reflection or background
 * buffering, without re-deriving state that `tryActivateBufferedReflection`
 * already evaluated.
 */
type TryActivateResult =
  | { status: 'activated' }
  | { status: 'no-buffer' }
  | { status: 'suppressed'; reason: 'composition' | 'size' };

/**
 * Runs the Reflector agent for compressing observations.
 * Handles synchronous reflection, async buffered reflection, and activation.
 */
export class ReflectorRunner {
  private readonly reflectionConfig: ResolvedReflectionConfig;
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly tokenCounter: TokenCounter;
  private readonly resolveModel: ReflectionModelResolver;

  private readonly storage: MemoryStorage;
  private readonly scope: 'thread' | 'resource';
  private readonly buffering: BufferingCoordinator;
  private readonly emitDebugEvent: (event: ObservationDebugEvent) => void;
  private readonly persistMarkerToStorage: (
    marker: { type: string; data: unknown },
    threadId: string,
    resourceId?: string,
  ) => Promise<void>;
  private readonly persistMarkerToMessage: (
    marker: { type: string; data: unknown },
    messageList: MessageList | undefined,
    threadId: string,
    resourceId?: string,
  ) => Promise<void>;
  private readonly getCompressionStartLevel: (requestContext?: RequestContext) => Promise<CompressionLevel>;
  private mastra?: Mastra;

  constructor(opts: {
    reflectionConfig: ResolvedReflectionConfig;
    observationConfig: ResolvedObservationConfig;
    tokenCounter: TokenCounter;
    storage: MemoryStorage;
    scope: 'thread' | 'resource';
    buffering: BufferingCoordinator;
    emitDebugEvent: (event: ObservationDebugEvent) => void;
    persistMarkerToStorage: (
      marker: { type: string; data: unknown },
      threadId: string,
      resourceId?: string,
    ) => Promise<void>;
    persistMarkerToMessage: (
      marker: { type: string; data: unknown },
      messageList: MessageList | undefined,
      threadId: string,
      resourceId?: string,
    ) => Promise<void>;
    getCompressionStartLevel: (requestContext?: RequestContext) => Promise<CompressionLevel>;
    resolveModel: ReflectionModelResolver;
    mastra?: Mastra;
  }) {
    this.reflectionConfig = opts.reflectionConfig;
    this.observationConfig = opts.observationConfig;
    this.tokenCounter = opts.tokenCounter;
    this.resolveModel = opts.resolveModel;
    this.storage = opts.storage;
    this.scope = opts.scope;
    this.buffering = opts.buffering;
    this.emitDebugEvent = opts.emitDebugEvent;
    this.persistMarkerToStorage = opts.persistMarkerToStorage;
    this.persistMarkerToMessage = opts.persistMarkerToMessage;
    this.getCompressionStartLevel = opts.getCompressionStartLevel;
    this.mastra = opts.mastra;
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  private createAgent(model: ConcreteReflectionModel): Agent {
    const agent = new Agent({
      id: 'observational-memory-reflector',
      name: 'Reflector',
      instructions: buildReflectorSystemPrompt(this.reflectionConfig.instruction),
      model,
    });
    if (this.mastra) {
      agent.__registerMastra(this.mastra);
    }
    return agent;
  }

  private getObservationMarkerConfig(record?: ObservationalMemoryRecord): ObservationMarkerConfig {
    return {
      messageTokens: getMaxThreshold(this.observationConfig.messageTokens),
      observationTokens: getMaxThreshold(
        record ? this.getEffectiveReflectionTokens(record) : this.reflectionConfig.observationTokens,
      ),
      scope: this.scope,
      activateAfterIdle: this.reflectionConfig.activateAfterIdle,
    };
  }

  /**
   * Resolve the effective reflection observationTokens for a record.
   * Only explicit per-record overrides (stored under `_overrides`) win;
   * the initial config snapshot is ignored so instance-level changes
   * still take effect for existing records.
   */
  private getEffectiveReflectionTokens(record: ObservationalMemoryRecord): number | ThresholdRange {
    const overrides = (
      record.config as { _overrides?: { reflection?: { observationTokens?: number | ThresholdRange } } }
    )?._overrides;
    const recordTokens = overrides?.reflection?.observationTokens;
    if (recordTokens) {
      return recordTokens;
    }
    return this.reflectionConfig.observationTokens;
  }

  /**
   * Call the Reflector agent with escalating compression levels.
   */
  async call(
    observations: string,
    manualPrompt?: string,
    streamContext?: {
      writer?: ProcessorStreamWriter;
      cycleId: string;
      startedAt: string;
      recordId: string;
      threadId: string;
      resourceId?: string;
    },
    observationTokensThreshold?: number,
    abortSignal?: AbortSignal,
    skipContinuationHints?: boolean,
    compressionStartLevel?: CompressionLevel,
    requestContext?: RequestContext,
    observabilityContext?: ObservabilityContext,
    model?: ConcreteReflectionModel,
  ): Promise<{
    observations: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const originalTokens = this.tokenCounter.countObservations(observations);
    const resolvedModel = model ? { model } : this.resolveModel(originalTokens);
    const agent = this.createAgent(resolvedModel.model);
    const targetThreshold = observationTokensThreshold ?? getMaxThreshold(this.reflectionConfig.observationTokens);

    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    const startLevel: CompressionLevel = compressionStartLevel ?? 0;
    let currentLevel: CompressionLevel = startLevel;
    const maxLevel: CompressionLevel = Math.min(MAX_COMPRESSION_LEVEL, startLevel + 3) as CompressionLevel;
    let parsed: ReturnType<typeof parseReflectorOutput> = { observations: '', suggestedContinuation: undefined };
    let reflectedTokens = 0;
    let attemptNumber = 0;

    while (currentLevel <= maxLevel) {
      attemptNumber++;
      const isRetry = attemptNumber > 1;

      const prompt = buildReflectorPrompt(observations, manualPrompt, currentLevel, skipContinuationHints);
      omDebug(
        `[OM:callReflector] ${isRetry ? `retry #${attemptNumber - 1}` : 'first attempt'}: level=${currentLevel}, originalTokens=${originalTokens}, targetThreshold=${targetThreshold}, promptLen=${prompt.length}, skipContinuationHints=${skipContinuationHints}`,
      );

      let chunkCount = 0;
      const result = await withOmTracingSpan({
        phase: 'reflector',
        model: resolvedModel.model,
        inputTokens: originalTokens,
        requestContext,
        observabilityContext,
        metadata: {
          omCompressionLevel: currentLevel,
          omCompressionAttempt: attemptNumber,
          omTargetThreshold: targetThreshold,
          omSkipContinuationHints: skipContinuationHints ?? false,
          ...(resolvedModel.selectedThreshold !== undefined
            ? { omSelectedThreshold: resolvedModel.selectedThreshold }
            : {}),
          ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
          ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
        },
        callback: childObservabilityContext =>
          withAbortCheck(async () => {
            const streamResult = await agent.stream(prompt, {
              modelSettings: {
                ...this.reflectionConfig.modelSettings,
              },
              providerOptions: this.reflectionConfig.providerOptions as any,
              ...(abortSignal ? { abortSignal } : {}),
              ...(requestContext ? { requestContext } : {}),
              ...childObservabilityContext,
              ...(attemptNumber === 1
                ? {
                    onChunk(chunk: any) {
                      chunkCount++;
                      if (chunkCount === 1 || chunkCount % 50 === 0) {
                        const preview =
                          chunk.type === 'text-delta'
                            ? ` text="${chunk.textDelta?.slice(0, 80)}..."`
                            : chunk.type === 'tool-call'
                              ? ` tool=${chunk.toolName}`
                              : '';
                        omDebug(`[OM:callReflector] chunk#${chunkCount}: type=${chunk.type}${preview}`);
                      }
                    },
                    onFinish(event: any) {
                      omDebug(
                        `[OM:callReflector] onFinish: chunks=${chunkCount}, finishReason=${event.finishReason}, inputTokens=${event.usage?.inputTokens}, outputTokens=${event.usage?.outputTokens}, textLen=${event.text?.length}`,
                      );
                    },
                    onAbort(event: any) {
                      omDebug(`[OM:callReflector] onAbort: chunks=${chunkCount}, reason=${event?.reason ?? 'unknown'}`);
                    },
                    onError({ error }: { error: unknown }) {
                      omError(`[OM:callReflector] onError after ${chunkCount} chunks`, error);
                    },
                  }
                : {}),
            });

            return streamResult.getFullOutput();
          }, abortSignal),
      });

      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} returned: textLen=${result.text?.length}, textPreview="${result.text?.slice(0, 120)}...", inputTokens=${result.usage?.inputTokens ?? result.totalUsage?.inputTokens}, outputTokens=${result.usage?.outputTokens ?? result.totalUsage?.outputTokens}`,
      );

      const usage = result.totalUsage ?? result.usage;
      if (usage) {
        totalUsage.inputTokens += usage.inputTokens ?? 0;
        totalUsage.outputTokens += usage.outputTokens ?? 0;
        totalUsage.totalTokens += usage.totalTokens ?? 0;
      }

      parsed = parseReflectorOutput(result.text, observations);

      if (parsed.degenerate) {
        omDebug(
          `[OM:callReflector] attempt #${attemptNumber}: degenerate repetition detected, treating as compression failure`,
        );
        reflectedTokens = originalTokens;
      } else {
        reflectedTokens = this.tokenCounter.countObservations(parsed.observations);
      }
      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} parsed: reflectedTokens=${reflectedTokens}, targetThreshold=${targetThreshold}, compressionValid=${validateCompression(reflectedTokens, targetThreshold)}, parsedObsLen=${parsed.observations?.length}, degenerate=${parsed.degenerate ?? false}`,
      );

      if (!parsed.degenerate && (validateCompression(reflectedTokens, targetThreshold) || currentLevel >= maxLevel)) {
        break;
      }

      if (parsed.degenerate && currentLevel >= maxLevel) {
        omDebug(`[OM:callReflector] degenerate output persists at maxLevel=${maxLevel}, breaking`);
        break;
      }

      // Emit failed marker and start marker for next retry
      if (streamContext?.writer) {
        const failedMarker = createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: originalTokens,
          error: `Did not compress below threshold (${originalTokens} → ${reflectedTokens}, target: ${targetThreshold}), retrying at level ${currentLevel + 1}`,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
        });
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        await streamContext.writer.custom({ ...failedMarker, transient: true }).catch(() => {});
        await this.persistMarkerToStorage(failedMarker, streamContext.threadId, streamContext.resourceId);

        const retryCycleId = crypto.randomUUID();
        streamContext.cycleId = retryCycleId;

        const startMarker = createObservationStartMarker({
          cycleId: retryCycleId,
          operationType: 'reflection',
          tokensToObserve: originalTokens,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
          threadIds: [streamContext.threadId],
          config: this.getObservationMarkerConfig(),
        });
        streamContext.startedAt = startMarker.data.startedAt;
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        await streamContext.writer.custom({ ...startMarker, transient: true }).catch(() => {});
        await this.persistMarkerToStorage(startMarker, streamContext.threadId, streamContext.resourceId);
      }

      currentLevel = Math.min(currentLevel + 1, maxLevel) as CompressionLevel;
    }

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
      usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
    };
  }

  /**
   * Start an async buffered reflection in the background.
   */
  private startAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    lockKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
    observabilityContext?: ObservabilityContext,
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>,
  ): void {
    const bufferKey = this.buffering.getReflectionBufferKey(lockKey);

    if (this.buffering.isAsyncBufferingInProgress(bufferKey)) {
      return;
    }

    BufferingCoordinator.lastBufferedBoundary.set(bufferKey, observationTokens);

    registerOp(record.id, 'bufferingReflection');
    this.storage.setBufferingReflectionFlag(record.id, true).catch(err => {
      omError('[OM] Failed to set buffering reflection flag', err);
    });

    reflectionHooks?.onReflectionStart?.();
    const asyncOp = this.doAsyncBufferedReflection(record, bufferKey, writer, requestContext, observabilityContext)
      .then(usage => {
        reflectionHooks?.onReflectionEnd?.({ usage });
      })
      .catch(async error => {
        if (writer) {
          const failedMarker = createBufferingFailedMarker({
            cycleId: `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            operationType: 'reflection',
            startedAt: new Date().toISOString(),
            tokensAttempted: observationTokens,
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId: record.threadId ?? '',
          });
          // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
          void writer.custom({ ...failedMarker, transient: true }).catch(() => {});
          await this.persistMarkerToStorage(failedMarker, record.threadId ?? '', record.resourceId ?? undefined);
        }
        omError('[OM] Async buffered reflection failed', error);
        reflectionHooks?.onReflectionEnd?.({
          usage: undefined,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Clear the boundary so a failed reflection doesn't permanently block
        // future async reflection attempts (line 554 checks this map).
        BufferingCoordinator.lastBufferedBoundary.delete(bufferKey);
      })
      .finally(() => {
        BufferingCoordinator.asyncBufferingOps.delete(bufferKey);
        unregisterOp(record.id, 'bufferingReflection');
        this.storage.setBufferingReflectionFlag(record.id, false).catch(err => {
          omError('[OM] Failed to clear buffering reflection flag', err);
        });
      });

    BufferingCoordinator.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Perform async buffered reflection — reflects observations and stores to bufferedReflection.
   * Does NOT create a new generation or update activeObservations.
   */
  private async doAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    _bufferKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
    observabilityContext?: ObservabilityContext,
  ): Promise<{ inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined> {
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const currentRecord = freshRecord ?? record;
    const observationTokens = currentRecord.observationTokenCount ?? 0;
    const reflectThreshold = getMaxThreshold(this.getEffectiveReflectionTokens(currentRecord));
    const bufferActivation = this.reflectionConfig.bufferActivation ?? 0.5;
    const startedAt = new Date().toISOString();
    const cycleId = `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    BufferingCoordinator.reflectionBufferCycleIds.set(_bufferKey, cycleId);

    const fullObservations = currentRecord.activeObservations ?? '';
    const allLines = fullObservations.split('\n');
    const totalLines = allLines.length;

    const avgTokensPerLine = totalLines > 0 ? observationTokens / totalLines : 0;
    const activationPointTokens = reflectThreshold * bufferActivation;
    const linesToReflect =
      avgTokensPerLine > 0 ? Math.min(Math.floor(activationPointTokens / avgTokensPerLine), totalLines) : totalLines;

    const activeObservations = allLines.slice(0, linesToReflect).join('\n');
    const reflectedObservationLineCount = linesToReflect;
    const sliceTokenEstimate = Math.round(avgTokensPerLine * linesToReflect);
    const compressionTarget = Math.round(sliceTokenEstimate * 0.75);

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: slicing observations for reflection — totalLines=${totalLines}, avgTokPerLine=${avgTokensPerLine.toFixed(1)}, activationPointTokens=${activationPointTokens}, linesToReflect=${linesToReflect}/${totalLines}, sliceTokenEstimate=${sliceTokenEstimate}, compressionTarget=${compressionTarget}`,
    );

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: starting reflector call, recordId=${currentRecord.id}, observationTokens=${sliceTokenEstimate}, compressionTarget=${compressionTarget} (inputTokens), activeObsLength=${activeObservations.length}, reflectedLineCount=${reflectedObservationLineCount}`,
    );

    if (writer) {
      const startMarker = createBufferingStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToBuffer: sliceTokenEstimate,
        recordId: record.id,
        threadId: record.threadId ?? '',
        threadIds: record.threadId ? [record.threadId] : [],
        config: this.getObservationMarkerConfig(currentRecord),
      });
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void writer.custom({ ...startMarker, transient: true }).catch(() => {});
      await this.persistMarkerToStorage(
        startMarker,
        currentRecord.threadId ?? '',
        currentRecord.resourceId ?? undefined,
      );
    }

    const compressionStartLevel = await this.getCompressionStartLevel(requestContext);
    const reflectResult = await this.call(
      activeObservations,
      undefined,
      undefined,
      compressionTarget,
      undefined,
      true,
      compressionStartLevel,
      requestContext,
      observabilityContext,
    );

    const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: reflector returned ${reflectionTokenCount} tokens (${reflectResult.observations?.length} chars), saving to recordId=${currentRecord.id}`,
    );

    await this.storage.updateBufferedReflection({
      id: currentRecord.id,
      reflection: reflectResult.observations,
      tokenCount: reflectionTokenCount,
      inputTokenCount: sliceTokenEstimate,
      reflectedObservationLineCount,
    });
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: bufferedReflection saved with lineCount=${reflectedObservationLineCount}`,
    );

    if (writer) {
      const endMarker = createBufferingEndMarker({
        cycleId,
        operationType: 'reflection',
        startedAt,
        tokensBuffered: sliceTokenEstimate,
        bufferedTokens: reflectionTokenCount,
        recordId: currentRecord.id,
        threadId: currentRecord.threadId ?? '',
        observations: reflectResult.observations,
      });
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void writer.custom({ ...endMarker, transient: true }).catch(() => {});
      await this.persistMarkerToStorage(endMarker, currentRecord.threadId ?? '', currentRecord.resourceId ?? undefined);
    }

    return reflectResult.usage;
  }

  /**
   * Try to activate buffered reflection when threshold is reached.
   * Returns a discriminated result so the caller can distinguish between
   * "activated", "no buffer present", and "suppressed by overshoot guard"
   * without re-deriving that state.
   */
  private async tryActivateBufferedReflection(
    record: ObservationalMemoryRecord,
    lockKey: string,
    writer?: ProcessorStreamWriter,
    messageList?: MessageList,
    activationMetadata?: {
      triggeredBy: 'threshold' | 'ttl' | 'provider_change';
      lastActivityAt?: number;
      ttlExpiredMs?: number;
      previousModel?: string;
      currentModel?: string;
    },
  ): Promise<TryActivateResult> {
    const bufferKey = this.buffering.getReflectionBufferKey(lockKey);

    const asyncOp = BufferingCoordinator.asyncBufferingOps.get(bufferKey);
    if (asyncOp) {
      // TTL and provider-change triggers should not block on in-progress
      // reflection buffering. The async op will finish in the background
      // and the buffered result will be available for activation on the next turn.
      if (activationMetadata?.triggeredBy === 'ttl' || activationMetadata?.triggeredBy === 'provider_change') {
        omDebug(
          `[OM:reflect] tryActivateBufferedReflection: async op in progress, not blocking for ${activationMetadata.triggeredBy} trigger`,
        );
      } else {
        omDebug(`[OM:reflect] tryActivateBufferedReflection: waiting for in-progress op...`);
        try {
          await Promise.race([
            asyncOp,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5_000)),
          ]);
        } catch {
          // Timeout or error - proceed with what we have
        }
      }
    }

    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: recordId=${record.id}, hasBufferedReflection=${!!freshRecord?.bufferedReflection}, bufferedReflectionLen=${freshRecord?.bufferedReflection?.length ?? 0}`,
    );
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: freshRecord.id=${freshRecord?.id}, freshBufferedReflection=${freshRecord?.bufferedReflection ? 'present (' + freshRecord.bufferedReflection.length + ' chars)' : 'empty'}, freshObsTokens=${freshRecord?.observationTokenCount}`,
    );

    if (!freshRecord?.bufferedReflection) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: no buffered reflection after re-fetch`);
      return { status: 'no-buffer' };
    }

    const beforeTokens = freshRecord.observationTokenCount ?? 0;

    const reflectedLineCount = freshRecord.reflectedObservationLineCount ?? 0;
    const currentObservations = freshRecord.activeObservations ?? '';
    const allLines = currentObservations.split('\n');
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join('\n').trim();
    const combinedObservations = unreflectedContent
      ? `${freshRecord.bufferedReflection}\n\n${unreflectedContent}`
      : freshRecord.bufferedReflection!;
    const combinedTokenCount = this.tokenCounter.countObservations(combinedObservations);

    // Early-trigger overshoot guard:
    // TTL and provider-change triggers can fire immediately after a buffered reflection
    // is written — before observations have grown enough to produce a healthy
    // activation outcome. Two checks guard against this:
    //
    // 1. Composition floor (≥ 50/50 mix): unreflected tail must be at least as
    //    large as the buffered reflection. Prevents post-activation active
    //    observations from collapsing to ~just the buffered reflection.
    //
    // 2. Size floor (≥ 75% of regular activation target): combined
    //    reflection + tail must be at least 75% of what a normal threshold
    //    activation would leave. Regular activation target ≈ reflectThreshold
    //    × (1 − bufferActivation) (the raw tail remaining when a threshold
    //    activation fires). 75% keeps early fires close to the system's tuned
    //    post-activation size while still allowing them to happen sooner than
    //    normal. Prevents cliff cases like 17k → 4k active observations.
    //
    // If either check fails, keep the buffer in place for the eventual
    // threshold activation.
    if (activationMetadata?.triggeredBy === 'ttl' || activationMetadata?.triggeredBy === 'provider_change') {
      const unreflectedTailTokens = unreflectedContent ? this.tokenCounter.countObservations(unreflectedContent) : 0;
      const bufferedReflectionTokens = freshRecord.bufferedReflectionTokens ?? 0;
      if (unreflectedTailTokens < bufferedReflectionTokens) {
        omDebug(
          `[OM:reflect] tryActivateBufferedReflection: suppressing early ${activationMetadata.triggeredBy} activation — unreflectedTailTokens=${unreflectedTailTokens} < bufferedReflectionTokens=${bufferedReflectionTokens}; keeping buffer for threshold activation`,
        );
        return { status: 'suppressed', reason: 'composition' };
      }

      // bufferActivation is guaranteed defined here: reaching this function
      // requires isAsyncReflectionEnabled(), which in turn requires a
      // defined, positive bufferActivation. Dropping the ?? fallback keeps
      // that invariant visible in the types.
      const bufferActivation = this.reflectionConfig.bufferActivation!;
      const reflectThreshold = getMaxThreshold(this.getEffectiveReflectionTokens(freshRecord));
      const regularActivationTarget = reflectThreshold * (1 - bufferActivation);
      const minCombinedTokens = Math.round(regularActivationTarget * EARLY_ACTIVATION_SIZE_FLOOR_RATIO);
      if (combinedTokenCount < minCombinedTokens) {
        omDebug(
          `[OM:reflect] tryActivateBufferedReflection: suppressing early ${activationMetadata.triggeredBy} activation — combinedTokenCount=${combinedTokenCount} < minCombinedTokens=${minCombinedTokens} (${EARLY_ACTIVATION_SIZE_FLOOR_RATIO * 100}% of regular activation target ${Math.round(regularActivationTarget)}, threshold=${reflectThreshold}, bufferActivation=${bufferActivation}); keeping buffer for threshold activation`,
        );
        return { status: 'suppressed', reason: 'size' };
      }
    }

    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activating, beforeTokens=${beforeTokens}, combinedTokenCount=${combinedTokenCount}, reflectedLineCount=${reflectedLineCount}, unreflectedLines=${unreflectedLines.length}`,
    );
    await this.storage.swapBufferedReflectionToActive({
      currentRecord: freshRecord,
      tokenCount: combinedTokenCount,
    });

    BufferingCoordinator.lastBufferedBoundary.delete(bufferKey);

    const afterRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const afterTokens = afterRecord?.observationTokenCount ?? 0;
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activation complete! beforeTokens=${beforeTokens}, afterTokens=${afterTokens}, newRecordId=${afterRecord?.id}, newGenCount=${afterRecord?.generationCount}`,
    );

    if (writer) {
      const originalCycleId = BufferingCoordinator.reflectionBufferCycleIds.get(bufferKey);
      const activationMarker = createActivationMarker({
        cycleId: originalCycleId ?? `reflect-act-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: beforeTokens,
        observationTokens: afterTokens,
        messagesActivated: 0,
        recordId: freshRecord.id,
        threadId: freshRecord.threadId ?? '',
        generationCount: afterRecord?.generationCount ?? freshRecord.generationCount ?? 0,
        observations: afterRecord?.activeObservations,
        triggeredBy: activationMetadata?.triggeredBy,
        lastActivityAt: activationMetadata?.lastActivityAt,
        ttlExpiredMs: activationMetadata?.ttlExpiredMs,
        previousModel: activationMetadata?.previousModel,
        currentModel: activationMetadata?.currentModel,
        config: this.getObservationMarkerConfig(freshRecord),
      });
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void writer.custom({ ...activationMarker, transient: true }).catch(() => {});
      await this.persistMarkerToMessage(
        activationMarker,
        messageList,
        freshRecord.threadId ?? '',
        freshRecord.resourceId ?? undefined,
      );
    }

    BufferingCoordinator.reflectionBufferCycleIds.delete(bufferKey);

    return { status: 'activated' };
  }

  /**
   * Check if reflection needed and trigger if so.
   * Supports both synchronous reflection and async buffered reflection.
   * @internal Used by observation strategies. Do not call directly.
   */
  async maybeReflect(opts: {
    record: ObservationalMemoryRecord;
    observationTokens: number;
    threadId?: string;
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    messageList?: MessageList;
    currentModel?: ObservationModelContext;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
    observabilityContext?: ObservabilityContext;
    lastActivityAt?: number;
  }): Promise<void> {
    const {
      record,
      observationTokens,
      writer,
      abortSignal,
      messageList,
      currentModel,
      reflectionHooks,
      requestContext,
      observabilityContext,
      lastActivityAt,
      threadId: requestedThreadId,
    } = opts;
    const lockKey = this.buffering.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = getMaxThreshold(this.getEffectiveReflectionTokens(record));

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC BUFFERING: Trigger background reflection at bufferActivation ratio
    // ════════════════════════════════════════════════════════════════════════
    if (this.buffering.isAsyncReflectionEnabled() && observationTokens < reflectThreshold) {
      const shouldTrigger = (() => {
        if (!this.buffering.isAsyncReflectionEnabled()) return false;
        if (record.isBufferingReflection) {
          if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
          omDebug(`[OM:shouldTriggerAsyncRefl] isBufferingReflection=true but stale, clearing`);
          this.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
        }
        const bufferKey = this.buffering.getReflectionBufferKey(lockKey);
        if (this.buffering.isAsyncBufferingInProgress(bufferKey)) return false;
        if (BufferingCoordinator.lastBufferedBoundary.has(bufferKey)) return false;
        if (record.bufferedReflection) return false;
        const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;
        return observationTokens >= activationPoint;
      })();
      if (shouldTrigger) {
        this.startAsyncBufferedReflection(
          record,
          observationTokens,
          lockKey,
          writer,
          requestContext,
          observabilityContext,
          reflectionHooks,
        );
      }
    }

    const activateAfterIdle = this.reflectionConfig.activateAfterIdle;
    const ttlExpiredMs =
      activateAfterIdle !== undefined && lastActivityAt !== undefined ? Date.now() - lastActivityAt : undefined;
    const ttlExpired =
      ttlExpiredMs !== undefined && activateAfterIdle !== undefined && ttlExpiredMs >= activateAfterIdle;
    const actorModel = getCurrentModel(currentModel);
    const lastModel = getLastModelFromMessageList(messageList);
    const providerChanged =
      this.reflectionConfig.activateOnProviderChange === true && didProviderChange(actorModel, lastModel);

    if (observationTokens < reflectThreshold && !ttlExpired && !providerChanged) {
      return;
    }

    const activationTriggeredBy =
      observationTokens >= reflectThreshold
        ? ('threshold' as const)
        : providerChanged
          ? ('provider_change' as const)
          : ('ttl' as const);
    const activationMetadata = {
      triggeredBy: activationTriggeredBy,
      lastActivityAt: activationTriggeredBy === 'ttl' ? lastActivityAt : undefined,
      ttlExpiredMs: activationTriggeredBy === 'ttl' ? ttlExpiredMs : undefined,
      previousModel: activationTriggeredBy === 'provider_change' ? lastModel : undefined,
      currentModel: activationTriggeredBy === 'provider_change' ? actorModel : undefined,
    };

    // ═══════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) {
        omDebug(`[OM:reflect] isReflecting=true and active in this process, skipping`);
        return;
      }
      omDebug(`[OM:reflect] isReflecting=true but NOT active in this process — stale flag from dead process, clearing`);
      await this.storage.setReflectingFlag(record.id, false);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC ACTIVATION: Try to activate buffered reflection first
    // ════════════════════════════════════════════════════════════════════════
    if (this.buffering.isAsyncReflectionEnabled()) {
      const activationResult = await this.tryActivateBufferedReflection(
        record,
        lockKey,
        writer,
        messageList,
        activationMetadata,
      );
      if (activationResult.status === 'activated') {
        return;
      }
      // Early-trigger overshoot guard: tryActivateBufferedReflection already
      // decided the early trigger should not activate the existing buffer.
      // Don't fall through to sync reflection (which would compress the
      // entire active observations — the lossy outcome we're preventing) or
      // start another background buffering op on top of the existing one.
      // Return and let the next turn re-evaluate.
      if (activationResult.status === 'suppressed') {
        omDebug(
          `[OM:reflect] skipping sync fallback / re-buffer after suppressed early ${activationMetadata.triggeredBy} activation (reason=${activationResult.reason})`,
        );
        return;
      }
      if (this.reflectionConfig.blockAfter && observationTokens >= this.reflectionConfig.blockAfter) {
        omDebug(
          `[OM:reflect] blockAfter exceeded (${observationTokens} >= ${this.reflectionConfig.blockAfter}), falling through to sync reflection`,
        );
      } else {
        const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;
        if (observationTokens < activationPoint) {
          omDebug(
            `[OM:reflect] skipping async reflection — observationTokens (${observationTokens}) below activation point (${activationPoint}), triggered by ${activationTriggeredBy}`,
          );
          return;
        }
        omDebug(
          `[OM:reflect] async activation failed, no blockAfter or below it (obsTokens=${observationTokens}, blockAfter=${this.reflectionConfig.blockAfter}) — starting background reflection`,
        );
        this.startAsyncBufferedReflection(
          record,
          observationTokens,
          lockKey,
          writer,
          requestContext,
          observabilityContext,
          reflectionHooks,
        );
        return;
      }
    }

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    reflectionHooks?.onReflectionStart?.();
    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    const cycleId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const threadId = requestedThreadId ?? 'unknown';

    if (writer) {
      const startMarker = createObservationStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToObserve: observationTokens,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
        config: this.getObservationMarkerConfig(record),
      });
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      await writer.custom({ ...startMarker, transient: true }).catch(() => {});
      await this.persistMarkerToStorage(startMarker, threadId, record.resourceId ?? undefined);
    }

    this.emitDebugEvent({
      type: 'reflection_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      inputTokens: observationTokens,
      activeObservationsLength: record.activeObservations?.length ?? 0,
    });

    const streamContext = writer
      ? {
          writer,
          cycleId,
          startedAt,
          recordId: record.id,
          threadId,
          resourceId: record.resourceId ?? undefined,
        }
      : undefined;

    let reflectionUsage: ObserveHookUsage | undefined;
    let reflectionError: Error | undefined;
    try {
      const compressionStartLevel = await this.getCompressionStartLevel(requestContext);
      const reflectResult = await this.call(
        record.activeObservations,
        undefined,
        streamContext,
        reflectThreshold,
        abortSignal,
        undefined,
        compressionStartLevel,
        requestContext,
        observabilityContext,
      );
      reflectionUsage = reflectResult.usage;
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      if (writer && streamContext) {
        const endMarker = createObservationEndMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensObserved: observationTokens,
          observationTokens: reflectionTokenCount,
          observations: reflectResult.observations,
          recordId: record.id,
          threadId,
        });
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        await writer.custom({ ...endMarker, transient: true }).catch(() => {});
        await this.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
      }

      this.emitDebugEvent({
        type: 'reflection_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        inputTokens: observationTokens,
        outputTokens: reflectionTokenCount,
        observations: reflectResult.observations,
        usage: reflectResult.usage,
      });
    } catch (error) {
      if (writer && streamContext) {
        const failedMarker = createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: observationTokens,
          error: error instanceof Error ? error.message : String(error),
          recordId: record.id,
          threadId,
        });
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        await writer.custom({ ...failedMarker, transient: true }).catch(() => {});
        await this.persistMarkerToStorage(failedMarker, threadId, record.resourceId ?? undefined);
      }
      reflectionError = error instanceof Error ? error : new Error(String(error));
      if (abortSignal?.aborted) {
        throw error;
      }
      omError('[OM] Reflection failed', error);
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
      reflectionHooks?.onReflectionEnd?.({ usage: reflectionUsage, error: reflectionError });
      unregisterOp(record.id, 'reflecting');
    }
  }
}

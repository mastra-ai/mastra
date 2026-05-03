import { EntityType } from '@internal/core/storage';
import type { Span } from '../types';
import { SpanType } from '../types';
import type {
  PromptRole,
  PromptSummary,
  PromptToolWaterfall,
  PromptToolWaterfallDelta,
  PromptToolWaterfallPhase,
  PromptToolWaterfallPhaseKind,
  PromptToolWaterfallStatus,
  ToolSurfaceSummary,
} from './types';

const roleKeys: PromptRole[] = ['system', 'user', 'assistant', 'tool', 'other'];

function arrayDiff(before: string[] = [], after: string[] = []) {
  return after.filter(item => !before.includes(item));
}

function toolNames(surface: ToolSurfaceSummary): string[] {
  return surface.tools.map(tool => tool.name);
}

function safeStringify(value: unknown): string {
  if (value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.length : String(value ?? '').length;
}

function statusPriority(status: PromptToolWaterfallStatus): number {
  return status === 'error' ? 2 : status === 'tripwire' ? 1 : 0;
}

function createDelta(
  previous: Pick<PromptToolWaterfallPhase, 'prompt' | 'toolSurface'> | undefined,
  next: Pick<PromptToolWaterfallPhase, 'prompt' | 'toolSurface'>,
  structuredOutput?: PromptToolWaterfallDelta['structuredOutput'],
): PromptToolWaterfallDelta {
  const previousPrompt = previous?.prompt;
  const previousToolSurface = previous?.toolSurface;
  const promptCharsByRoleDelta: Partial<Record<PromptRole, number>> = {};

  for (const role of roleKeys) {
    const delta = next.prompt.charsByRole[role] - (previousPrompt?.charsByRole[role] ?? 0);
    if (delta !== 0) {
      promptCharsByRoleDelta[role] = delta;
    }
  }

  const previousToolNames = previousToolSurface ? toolNames(previousToolSurface) : [];
  const nextToolNames = toolNames(next.toolSurface);
  const previousActiveTools = previousToolSurface?.activeTools ?? [];
  const nextActiveTools = next.toolSurface.activeTools ?? [];

  return {
    promptCharsDelta: next.prompt.totalChars - (previousPrompt?.totalChars ?? 0),
    promptCharsByRoleDelta,
    messageCountDelta: next.prompt.messageCount - (previousPrompt?.messageCount ?? 0),
    toolsAdded: arrayDiff(previousToolNames, nextToolNames),
    toolsRemoved: arrayDiff(nextToolNames, previousToolNames),
    toolCountDelta: next.toolSurface.toolCount - (previousToolSurface?.toolCount ?? 0),
    activeToolsAdded: arrayDiff(previousActiveTools, nextActiveTools),
    activeToolsRemoved: arrayDiff(nextActiveTools, previousActiveTools),
    toolChoiceChanged: safeStringify(previousToolSurface?.toolChoice) !== safeStringify(next.toolSurface.toolChoice),
    ...(structuredOutput ? { structuredOutput } : {}),
  };
}

export class PromptToolWaterfallRecorder {
  readonly runId: string;
  #phases: PromptToolWaterfallPhase[] = [];
  #finalized?: PromptToolWaterfall;
  #spanFinalized = false;

  constructor({ runId }: { runId: string }) {
    this.runId = runId;
  }

  get finalized() {
    return this.#finalized;
  }

  recordPhase({
    kind,
    stepIndex,
    prompt,
    toolSurface,
    structuredOutput,
    meta,
  }: {
    kind: PromptToolWaterfallPhaseKind;
    stepIndex: number;
    prompt: PromptSummary;
    toolSurface: ToolSurfaceSummary;
    structuredOutput?: PromptToolWaterfallDelta['structuredOutput'];
    meta?: Record<string, string | number | boolean | undefined>;
  }) {
    if (this.#finalized) {
      return;
    }

    const previous = this.#phases.at(-1);
    const filteredMeta = meta
      ? Object.fromEntries(
          Object.entries(meta).filter((entry): entry is [string, string | number | boolean] => {
            return entry[1] !== undefined;
          }),
        )
      : undefined;

    this.#phases.push({
      kind,
      stepIndex,
      prompt,
      toolSurface,
      delta: createDelta(previous, { prompt, toolSurface }, structuredOutput),
      ...(filteredMeta && Object.keys(filteredMeta).length > 0 ? { meta: filteredMeta } : {}),
    });
  }

  finalize({
    status,
    tripwire,
    error,
  }: {
    status: PromptToolWaterfallStatus;
    tripwire?: { reason?: string; processorId?: string };
    error?: unknown;
  }): PromptToolWaterfall {
    const normalizedError =
      error instanceof Error
        ? { name: error.name, messageChars: error.message.length }
        : error
          ? { messageChars: textLength(error) }
          : undefined;
    const normalizedTripwire = tripwire?.reason
      ? {
          reasonChars: tripwire.reason.length,
          ...(tripwire.processorId ? { processorId: tripwire.processorId } : {}),
        }
      : undefined;

    if (this.#finalized) {
      if (statusPriority(status) > statusPriority(this.#finalized.status)) {
        this.#finalized = {
          ...this.#finalized,
          status,
          ...(normalizedTripwire ? { tripwire: normalizedTripwire } : {}),
          ...(normalizedError ? { error: normalizedError } : {}),
        };
      }
      return this.#finalized;
    }

    const finalPhase = this.#phases.at(-1);

    this.#finalized = {
      runId: this.runId,
      status,
      stepCount: new Set(this.#phases.map(phase => phase.stepIndex)).size,
      phases: this.#phases,
      ...(finalPhase ? { finalPrompt: finalPhase.prompt, finalToolSurface: finalPhase.toolSurface } : {}),
      ...(normalizedTripwire ? { tripwire: normalizedTripwire } : {}),
      ...(normalizedError ? { error: normalizedError } : {}),
    };

    return this.#finalized;
  }

  finalizeSpan({
    agentSpan,
    status,
    tripwire,
    error,
  }: {
    agentSpan?: Span<SpanType.AGENT_RUN>;
    status: PromptToolWaterfallStatus;
    tripwire?: { reason?: string; processorId?: string };
    error?: unknown;
  }): PromptToolWaterfall {
    const waterfall = this.finalize({ status, tripwire, error });

    if (agentSpan?.isValid && !this.#spanFinalized) {
      const span = agentSpan.createChildSpan({
        type: SpanType.PROMPT_TOOL_WATERFALL,
        name: 'prompt tool waterfall',
        entityType: EntityType.AGENT,
        entityId: agentSpan.entityId,
        entityName: agentSpan.entityName,
        attributes: {
          waterfall,
        },
      });
      span.end({
        output: waterfall,
      });
      this.#spanFinalized = true;
    }

    return waterfall;
  }
}

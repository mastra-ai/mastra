import { EntityType } from '@mastra/core/observability';
import type { SpanRecord } from '../types';
import { getSpanChanges } from './span-outcome.utils';

/** Processors that run after the model answered: whatever they change can't reach this call. */
const AFTER_MODEL: ReadonlySet<string> = new Set([
  EntityType.OUTPUT_PROCESSOR,
  EntityType.OUTPUT_STEP_PROCESSOR,
  EntityType.TOOL_RESULT_PROCESSOR,
]);

type Change = ReturnType<typeof getSpanChanges>[number];

const hasSystemMessages = (value: unknown) =>
  typeof value === 'object' && value !== null && Array.isArray((value as { systemMessages?: unknown }).systemMessages);

const hasRecordedChanges = (span: SpanRecord) => {
  const recorded = (span.attributes as { messageListMutations?: unknown } | null | undefined)?.messageListMutations;
  return Array.isArray(recorded) && recorded.length > 0;
};

/**
 * What this span changed in the request. Without recorded changes the system prompt is diffed from
 * input to output, which only means something when both sides carry it: a memory save reports the
 * current system prompt in its output only, and that is not an edit.
 */
export function getPromptChanges(span: SpanRecord): Change[] {
  if (!hasRecordedChanges(span) && !(hasSystemMessages(span.input) && hasSystemMessages(span.output))) return [];
  return getSpanChanges(span);
}

export const touchesSystemPrompt = (change: Change) =>
  change.type === 'addSystem' ||
  ((change.type === 'removeByIds' || change.type === 'add') && change.source === 'system');

/** Whether the span is a processor that ran after the model answered, so its changes can't have shaped this call. */
export const runsAfterModel = (span: SpanRecord) => AFTER_MODEL.has(span.entityType ?? '');

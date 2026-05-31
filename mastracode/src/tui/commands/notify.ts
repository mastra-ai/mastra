import type {
  NotificationPriority,
  NotificationSignalAttributes,
  SendNotificationSignalInput,
} from '@mastra/core/notifications';

import { askModalQuestion } from '../modal-question.js';
import type { SlashCommandContext } from './types.js';

const PRIORITIES: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];

type JsonParseResult<T> = { ok: true; value?: T } | { ok: false };

async function askChoice(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; description?: string }>,
  selectedOptionLabel?: string,
): Promise<string | null> {
  const answer = await askModalQuestion(ctx.state.ui, {
    question,
    options,
    selectedOptionLabel,
    defaultValue: selectedOptionLabel,
    allowCustomResponse: true,
  });
  return answer?.trim() || null;
}

async function askOptionalText(ctx: SlashCommandContext, question: string): Promise<string | null | undefined> {
  const answer = await askModalQuestion(ctx.state.ui, { question, allowEmptyInput: true });
  if (answer === null) return null;
  const trimmed = answer.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject<T extends Record<string, unknown>>(
  value: string | undefined,
  label: string,
  ctx: SlashCommandContext,
  validate?: (parsed: Record<string, unknown>) => boolean,
): JsonParseResult<T> {
  if (!value) return { ok: true };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    ctx.showError(`Invalid ${label} JSON: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false };
  }

  if (!isJsonObject(parsed)) {
    ctx.showError(`${label} must be a JSON object.`);
    return { ok: false };
  }

  if (validate && !validate(parsed)) {
    ctx.showError(`${label} values must be strings, numbers, booleans, or null.`);
    return { ok: false };
  }

  return { ok: true, value: parsed as T };
}

function hasOnlyAttributeValues(parsed: Record<string, unknown>): boolean {
  return Object.values(parsed).every(value => value === null || ['string', 'number', 'boolean'].includes(typeof value));
}

function describeDecision(action: string, record: { id: string }, when?: Date): string {
  const suffix = when ? ` until ${when.toISOString()}` : '';
  switch (action) {
    case 'deliver':
      return `Notification ${record.id} delivered.`;
    case 'queue':
      return `Notification ${record.id} queued.`;
    case 'defer':
      return `Notification ${record.id} batched for later delivery${suffix}.`;
    case 'summarize':
      return `Notification ${record.id} saved for summary${suffix}.`;
    case 'persist':
      return `Notification ${record.id} saved to inbox.`;
    case 'discard':
      return `Notification ${record.id} discarded.`;
    default:
      return `Notification ${record.id} saved (${action}).`;
  }
}

export async function handleNotifyCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const priorityAnswer = await askChoice(
    ctx,
    'Notification priority',
    PRIORITIES.map(priority => ({
      label: priority,
      description: priority === 'urgent' ? 'Interrupt immediately' : undefined,
    })),
    'medium',
  );
  if (priorityAnswer === null) return;

  const priority = priorityAnswer.toLowerCase() as NotificationPriority;
  if (!PRIORITIES.includes(priority)) {
    ctx.showError(`Unknown priority: ${priorityAnswer}. Use low, medium, high, or urgent.`);
    return;
  }

  const source = await askChoice(
    ctx,
    'Notification source',
    [{ label: 'mastracode', description: 'Manual notification from MastraCode' }],
    'mastracode',
  );
  if (source === null) return;

  const kind = await askChoice(
    ctx,
    'Notification kind',
    [{ label: 'manual', description: 'User-created notification' }],
    'manual',
  );
  if (kind === null) return;

  const input: SendNotificationSignalInput = {
    source,
    kind,
    priority,
    summary: '',
  };

  const advanced = await askModalQuestion(ctx.state.ui, {
    question: 'Configure advanced notification fields?',
    options: [
      { label: 'No', description: 'Use defaults' },
      { label: 'Yes', description: 'sourceId, keys, attributes, metadata' },
    ],
    selectedOptionLabel: 'No',
    allowCustomResponse: false,
  });
  if (advanced === null) return;

  if (advanced === 'Yes') {
    const sourceId = await askOptionalText(ctx, 'sourceId (optional)');
    if (sourceId === null) return;
    const dedupeKey = await askOptionalText(ctx, 'dedupeKey (optional)');
    if (dedupeKey === null) return;
    const coalesceKey = await askOptionalText(ctx, 'coalesceKey (optional)');
    if (coalesceKey === null) return;
    const attributesText = await askOptionalText(ctx, 'attributes JSON object (optional)');
    if (attributesText === null) return;
    const metadataText = await askOptionalText(ctx, 'metadata JSON object (optional)');
    if (metadataText === null) return;

    const attributes = parseJsonObject<NotificationSignalAttributes>(
      attributesText,
      'attributes',
      ctx,
      hasOnlyAttributeValues,
    );
    if (!attributes.ok) return;
    const metadata = parseJsonObject(metadataText, 'metadata', ctx);
    if (!metadata.ok) return;

    if (sourceId) input.sourceId = sourceId;
    if (dedupeKey) input.dedupeKey = dedupeKey;
    if (coalesceKey) input.coalesceKey = coalesceKey;
    if (attributes.value) input.attributes = attributes.value;
    if (metadata.value) input.metadata = metadata.value;
  }

  const inlineContents = args.join(' ').trim();
  const contents = await askModalQuestion(ctx.state.ui, {
    question: 'Notification contents',
    defaultValue: inlineContents,
    multiline: true,
    overlay: { widthPercent: 80, maxHeight: '70%' },
  });
  if (contents === null) return;

  const summary = contents.trim();
  if (!summary) {
    ctx.showError('Notification contents cannot be empty.');
    return;
  }

  input.summary = summary;

  try {
    const result = await ctx.harness.sendNotificationSignal(input);
    const when = result.decision.action === 'defer' ? result.decision.deliverAt : result.decision.summaryAt;
    ctx.showInfo(describeDecision(result.decision.action, result.record, when));
  } catch (error) {
    ctx.showError(`Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

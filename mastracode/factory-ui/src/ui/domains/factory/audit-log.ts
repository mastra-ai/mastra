import type { AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import { AUDIT_ACTIONS } from '@mastra/factory/storage/domains/audit/actions';

import type { AuditEvent } from './services/audit';
import { stageLabel } from './stages';

/** Labelling every namespace is what keeps a new action from shipping as an unnamed lane. */
export const NAMESPACE_LABELS = {
  work_item: 'Work items',
  run: 'Runs',
  git: 'Git',
  agent: 'Agent',
  intake: 'Intake',
} satisfies Record<AuditNamespace, string>;

/** Categorical, not a ramp: the colour is what makes a namespace scannable in a mixed stream. */
export const NAMESPACE_PAINT = {
  work_item: { dot: 'bg-accent3', fill: 'fill-accent3' },
  run: { dot: 'bg-accent1', fill: 'fill-accent1' },
  git: { dot: 'bg-pr-merged', fill: 'fill-pr-merged' },
  agent: { dot: 'bg-accent6', fill: 'fill-accent6' },
  intake: { dot: 'bg-icon2', fill: 'fill-icon2' },
} satisfies Record<AuditNamespace, { dot: string; fill: string }>;

const isNamespace = (segment: string | undefined): segment is AuditNamespace =>
  segment !== undefined && segment in NAMESPACE_LABELS;

/** Derived from the taxonomy, so no lane sits empty and no action hides from every lane. */
export const AUDIT_NAMESPACES: AuditNamespace[] = [
  ...new Set(AUDIT_ACTIONS.map(action => action.split('.')[1])),
].filter(isNamespace);

export function namespaceOf(action: string): AuditNamespace | undefined {
  const segment = action.split('.')[1];
  return isNamespace(segment) ? segment : undefined;
}

/**
 * `work_item` is the log's default subject and the card column already names it,
 * so its verbs stand alone. Every other namespace says its name, or `commit`
 * reads identically whether git or an agent made it.
 */
export function actionLabel(action: string): string {
  const [, namespace, leaf] = action.split('.');
  const words = leaf === undefined ? action : namespace === 'work_item' ? leaf : `${namespace} ${leaf}`;
  const spaced = words.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Correlation ids the trail carries so support can join it to a run — they say
 * nothing to someone scanning the log, and they crowd out the keys that do.
 * The expanded row still shows them.
 */
const PLUMBING_KEYS = new Set([
  'decisionId',
  'transitionId',
  'bindingId',
  'sessionId',
  'threadId',
  'revision',
  'effect',
]);

const isReadable = ([key]: [string, unknown]) => !key.startsWith('__') && !PLUMBING_KEYS.has(key);

function pairs(metadata: Record<string, unknown>): [string, unknown][] {
  return Object.entries(metadata).filter(isReadable);
}

function render(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** What the row says it did, in the units of the action rather than of the table. */
export function eventDetail(event: AuditEvent): string {
  if (event.action === 'factory.work_item.stage_moved') {
    const { from, to } = event.metadata;
    const arrival = stageLabel(render(to));
    return typeof from === 'string' ? `${stageLabel(from)} → ${arrival}` : `→ ${arrival}`;
  }
  return pairs(event.metadata)
    .map(([key, value]) => `${key}=${render(value)}`)
    .join(' ');
}

/** Every key the event carries, plumbing included — the reason a row expands. */
export function eventMetadata(event: AuditEvent): [string, string][] {
  return Object.entries(event.metadata)
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, value]) => [key, render(value)]);
}

/** Agents sign with the mode they ran as; people with the name the trail stamped. */
export function actorLabel(event: AuditEvent, name: string | undefined): string {
  if (event.actorType !== 'agent') return name ?? event.actorId;
  const agentName = event.metadata.agentName;
  return typeof agentName === 'string' ? agentName : 'agent';
}

/** The work item an event touched, when it names one. */
export function targetItemId(event: AuditEvent): string | undefined {
  return event.targets.find(target => target.type === 'work_item')?.id;
}

export interface TimeSlice {
  from: number;
  to: number;
}

const HOUR = 3_600_000;
/** Below this a slice holds nothing a person can read, so a tap is one too. */
const MIN_SLICE = 4 * 60_000;

/** A drag picks the span between its ends; a tap picks the couple of hours around it. */
export function sliceBetween(anchor: number, here: number, bounds: TimeSlice): TimeSlice {
  const from = Math.max(bounds.from, Math.min(anchor, here));
  const to = Math.min(bounds.to, Math.max(anchor, here));
  if (to - from >= MIN_SLICE) return { from, to };
  return { from: Math.max(bounds.from, from - HOUR), to: Math.min(bounds.to, to + HOUR) };
}

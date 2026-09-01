import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';

import type { AuditEvent } from './services/audit';
import { stageLabel } from './stages';

export const AUDIT_CATEGORIES = [
  {
    namespace: 'work_item',
    tone: 'purple' satisfies BadgeVariant,
    label: 'Work items',
    dotClass: 'bg-accent3',
    strokeClass: 'stroke-accent3',
    actions: [
      'factory.work_item.created',
      'factory.work_item.updated',
      'factory.work_item.stage_moved',
      'factory.work_item.deleted',
      'factory.work_item.transition_rejected',
    ],
  },
  {
    namespace: 'run',
    tone: 'green' satisfies BadgeVariant,
    label: 'Runs',
    dotClass: 'bg-positive1',
    strokeClass: 'stroke-positive1',
    actions: ['factory.run.started', 'factory.run.approved', 'factory.run.dismissed'],
  },
  {
    namespace: 'worktree',
    tone: 'neutral' satisfies BadgeVariant,
    label: 'Worktrees',
    dotClass: 'bg-neutral3',
    strokeClass: 'stroke-neutral3',
    actions: ['factory.worktree.created', 'factory.worktree.deleted'],
  },
  {
    namespace: 'git',
    tone: 'orange' satisfies BadgeVariant,
    label: 'Git',
    dotClass: 'bg-(--chart-4)',
    strokeClass: 'stroke-(--chart-4)',
    actions: ['factory.git.commit', 'factory.git.push', 'factory.git.pr_opened'],
  },
  {
    namespace: 'agent',
    tone: 'blue' satisfies BadgeVariant,
    label: 'Agent',
    dotClass: 'bg-accent6',
    strokeClass: 'stroke-accent6',
    actions: ['factory.agent.commit', 'factory.agent.push', 'factory.agent.pr_opened'],
  },
  {
    namespace: 'intake',
    tone: 'cyan' satisfies BadgeVariant,
    label: 'Intake',
    dotClass: 'bg-neutral2',
    strokeClass: 'stroke-neutral2',
    actions: ['factory.intake.config_updated', 'factory.intake.binding_updated'],
  },
] as const;

export type AuditNamespace = (typeof AUDIT_CATEGORIES)[number]['namespace'];

export interface AuditTimeRange {
  from: number;
  to: number;
}

const AUDIT_SINGLE_EVENT_PADDING = 30 * 60_000;

export function auditEventTime(event: AuditEvent): number | undefined {
  const at = Date.parse(event.occurredAt);
  return Number.isFinite(at) ? at : undefined;
}

export function eventInAuditRange(event: AuditEvent, range: AuditTimeRange): boolean {
  const at = auditEventTime(event);
  return at !== undefined && at >= range.from && at <= range.to;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function auditRangeLabel(range: AuditTimeRange): string {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const sameDay = from.toDateString() === to.toDateString();
  const fromLabel = from.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const toLabel = to.toLocaleString(undefined, {
    month: sameDay ? undefined : 'short',
    day: sameDay ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fromLabel} – ${toLabel}`;
}

export function auditEventBounds(events: AuditEvent[]): AuditTimeRange | undefined {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const at = auditEventTime(event);
    if (at === undefined) continue;
    from = Math.min(from, at);
    to = Math.max(to, at);
  }

  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  if (from === to) return { from: from - AUDIT_SINGLE_EVENT_PADDING, to: to + AUDIT_SINGLE_EVENT_PADDING };
  return { from, to };
}

export function auditActionsForCategories(selected: ReadonlySet<AuditNamespace>): string[] | undefined {
  if (selected.size === 0 || selected.size === AUDIT_CATEGORIES.length) return undefined;
  const actions: string[] = [];
  for (const category of AUDIT_CATEGORIES) {
    if (selected.has(category.namespace)) actions.push(...category.actions);
  }
  return actions;
}

export function auditCategory(action: string) {
  const namespace = action.split('.')[1];
  return AUDIT_CATEGORIES.find(category => category.namespace === namespace);
}

function words(value: string): string {
  return value.replace(/_/g, ' ');
}

export function auditActionLabel(action: string): string {
  const [, namespace, leaf] = action.split('.');
  const prefix = namespace && namespace !== 'work_item' ? `${words(namespace)} ` : '';
  const description = leaf ? `${prefix}${words(leaf)}` : words(action);
  return description.charAt(0).toUpperCase() + description.slice(1);
}

function metadataValue(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
}

export function auditVisibleMetadata(event: AuditEvent): Record<string, unknown> {
  const visible: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.metadata)) {
    if (!key.startsWith('__')) visible[key] = value;
  }
  return visible;
}

export function auditMetadataPreview(event: AuditEvent): string {
  if (event.action === 'factory.work_item.stage_moved') {
    const from = event.metadata.from;
    const to = event.metadata.to;
    if (typeof to === 'string') {
      return typeof from === 'string' ? `${stageLabel(from)} → ${stageLabel(to)}` : `→ ${stageLabel(to)}`;
    }
  }

  const details: string[] = [];
  for (const [key, value] of Object.entries(auditVisibleMetadata(event))) {
    details.push(`${key}=${metadataValue(value)}`);
  }
  return details.join(' · ');
}

export function auditActorLabel(event: AuditEvent, actorName: string | undefined): string {
  if (event.actorType === 'human') return actorName ?? event.actorId;
  const agentName = event.metadata.agentName;
  return typeof agentName === 'string' ? agentName : (actorName ?? 'Agent');
}

import type { AuditEvent } from './services/audit';
import { stageLabel } from './stages';

export const AUDIT_CATEGORIES = [
  {
    namespace: 'work_item',
    label: 'Work items',
    dotClass: 'bg-accent3',
    fillClass: 'fill-accent3',
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
    label: 'Runs',
    dotClass: 'bg-positive1',
    fillClass: 'fill-positive1',
    actions: ['factory.run.started', 'factory.run.approved', 'factory.run.dismissed'],
  },
  {
    namespace: 'worktree',
    label: 'Worktrees',
    dotClass: 'bg-neutral3',
    fillClass: 'fill-neutral3',
    actions: ['factory.worktree.created', 'factory.worktree.deleted'],
  },
  {
    namespace: 'git',
    label: 'Git',
    dotClass: 'bg-(--chart-4)',
    fillClass: 'fill-(--chart-4)',
    actions: ['factory.git.commit', 'factory.git.push', 'factory.git.pr_opened'],
  },
  {
    namespace: 'agent',
    label: 'Agent',
    dotClass: 'bg-accent6',
    fillClass: 'fill-accent6',
    actions: ['factory.agent.commit', 'factory.agent.push', 'factory.agent.pr_opened'],
  },
  {
    namespace: 'intake',
    label: 'Intake',
    dotClass: 'bg-neutral2',
    fillClass: 'fill-neutral2',
    actions: ['factory.intake.config_updated', 'factory.intake.binding_updated'],
  },
] as const;

export type AuditNamespace = (typeof AUDIT_CATEGORIES)[number]['namespace'];

export interface AuditTimeRange {
  from: number;
  to: number;
}

const MINIMUM_AUDIT_RANGE = 5 * 60_000;
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

export function auditDayStart(date: Date): number {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export function auditDayEnd(date: Date): number {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}
export function auditRangeAround(center: number, span: number, bounds: AuditTimeRange): AuditTimeRange {
  const boundedSpan = Math.min(span, bounds.to - bounds.from);
  const from = clamp(center - boundedSpan / 2, bounds.from, bounds.to - boundedSpan);
  return { from, to: from + boundedSpan };
}

export function auditRangeBetween(anchor: number, current: number, bounds: AuditTimeRange): AuditTimeRange {
  const from = clamp(Math.min(anchor, current), bounds.from, bounds.to);
  const to = clamp(Math.max(anchor, current), bounds.from, bounds.to);
  const minimumSpan = Math.min(
    Math.max((bounds.to - bounds.from) * 0.03, MINIMUM_AUDIT_RANGE),
    bounds.to - bounds.from,
  );
  return to - from >= minimumSpan ? { from, to } : auditRangeAround((from + to) / 2, minimumSpan, bounds);
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

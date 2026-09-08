import { auditNamespaces, parseAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';

import type { AuditEvent } from './services/audit';
import { stageLabel } from './stages';

export type { AuditNamespace };

interface AuditCategoryStyle {
  tone: BadgeVariant;
  label: string;
  dotClass: string;
  strokeClass: string;
}

const AUDIT_CATEGORY_STYLES: Record<AuditNamespace, AuditCategoryStyle> = {
  work_item: { tone: 'purple', label: 'Work items', dotClass: 'bg-accent3', strokeClass: 'stroke-accent3' },
  run: { tone: 'green', label: 'Runs', dotClass: 'bg-positive1', strokeClass: 'stroke-positive1' },
  git: { tone: 'orange', label: 'Git', dotClass: 'bg-(--chart-4)', strokeClass: 'stroke-(--chart-4)' },
  agent: { tone: 'blue', label: 'Agent', dotClass: 'bg-accent6', strokeClass: 'stroke-accent6' },
  intake: { tone: 'cyan', label: 'Intake', dotClass: 'bg-neutral2', strokeClass: 'stroke-neutral2' },
};

/** The server's namespaces, in its order, dressed for the page. */
export const AUDIT_CATEGORIES = auditNamespaces().map(namespace => ({
  namespace,
  ...AUDIT_CATEGORY_STYLES[namespace],
}));

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

/** The server owns which actions a namespace holds; the page only names the namespaces. */
export function auditNamespacesForCategories(selected: ReadonlySet<AuditNamespace>): AuditNamespace[] | undefined {
  if (selected.size === 0 || selected.size === AUDIT_CATEGORIES.length) return undefined;
  return AUDIT_CATEGORIES.filter(category => selected.has(category.namespace)).map(category => category.namespace);
}

export function auditCategory(action: string) {
  const namespace = parseAuditAction(action)?.namespace;
  return AUDIT_CATEGORIES.find(category => category.namespace === namespace);
}

function words(value: string): string {
  return value.replace(/_/g, ' ');
}

export function auditActionLabel(action: string): string {
  const parsed = parseAuditAction(action);
  const prefix = parsed && parsed.namespace !== 'work_item' ? `${words(parsed.namespace)} ` : '';
  const description = parsed ? `${prefix}${words(parsed.leaf)}` : words(action);
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
  if (event.action === 'factory.run.ended' && typeof event.metadata.reason === 'string') return event.metadata.reason;
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
  if (event.actorType === 'system') return 'Factory';
  const agentName = event.metadata.agentName;
  return typeof agentName === 'string' ? agentName : (actorName ?? 'Agent');
}

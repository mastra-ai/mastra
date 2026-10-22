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
}

const AUDIT_CATEGORY_STYLES: Record<AuditNamespace, AuditCategoryStyle> = {
  work_item: { tone: 'purple', label: 'Work items', dotClass: 'bg-chart-blue' },
  run: { tone: 'green', label: 'Runs', dotClass: 'bg-chart-green' },
  git: { tone: 'orange', label: 'Git', dotClass: 'bg-chart-orange' },
  agent: { tone: 'blue', label: 'Agent', dotClass: 'bg-chart-amber' },
  intake: { tone: 'cyan', label: 'Intake', dotClass: 'bg-placeholder' },
  session: { tone: 'pink', label: 'Sessions', dotClass: 'bg-placeholder' },
};

/** The server's namespaces, in its order, dressed for the page. */
export const AUDIT_CATEGORIES = auditNamespaces().map(namespace => ({
  namespace,
  ...AUDIT_CATEGORY_STYLES[namespace],
}));

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

export function auditVisibleMetadata(event: AuditEvent): Record<string, unknown> {
  const visible: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.metadata)) {
    if (!key.startsWith('__')) visible[key] = value;
  }
  return visible;
}

export function auditDetailLine(event: AuditEvent): string {
  if (event.action === 'factory.run.ended' && typeof event.metadata.reason === 'string') return event.metadata.reason;
  const to = event.metadata.to;
  if (event.action !== 'factory.work_item.stage_moved' || typeof to !== 'string') return '';
  const from = event.metadata.from;
  return typeof from === 'string' ? `${stageLabel(from)} → ${stageLabel(to)}` : `→ ${stageLabel(to)}`;
}

/** What the factory itself is called wherever it acts as an actor. */
export const SYSTEM_ACTOR_NAME = 'Factory';

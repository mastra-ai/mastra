import type { AuditEvent } from './services/audit';
import { stageLabel } from './stages';

export const AUDIT_CATEGORIES = [
  { namespace: 'work_item', label: 'Work items', dotClass: 'bg-accent3', fillClass: 'fill-accent3' },
  { namespace: 'run', label: 'Runs', dotClass: 'bg-positive1', fillClass: 'fill-positive1' },
  { namespace: 'worktree', label: 'Worktrees', dotClass: 'bg-neutral3', fillClass: 'fill-neutral3' },
  { namespace: 'git', label: 'Git', dotClass: 'bg-(--chart-4)', fillClass: 'fill-(--chart-4)' },
  { namespace: 'agent', label: 'Agent', dotClass: 'bg-accent6', fillClass: 'fill-accent6' },
  { namespace: 'intake', label: 'Intake', dotClass: 'bg-neutral2', fillClass: 'fill-neutral2' },
] as const;

export type AuditNamespace = (typeof AUDIT_CATEGORIES)[number]['namespace'];

export interface AuditTimeRange {
  from: number;
  to: number;
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

export function auditMetadataPreview(event: AuditEvent): string {
  if (event.action === 'factory.work_item.stage_moved') {
    const from = event.metadata.from;
    const to = event.metadata.to;
    if (typeof to === 'string') {
      return typeof from === 'string' ? `${stageLabel(from)} → ${stageLabel(to)}` : `→ ${stageLabel(to)}`;
    }
  }

  const details: string[] = [];
  for (const [key, value] of Object.entries(event.metadata)) {
    if (!key.startsWith('__')) details.push(`${key}=${metadataValue(value)}`);
  }
  return details.join(' · ');
}

export function auditActorLabel(event: AuditEvent, actorName: string | undefined): string {
  if (event.actorType === 'human') return actorName ?? event.actorId;
  const agentName = event.metadata.agentName;
  return typeof agentName === 'string' ? agentName : (actorName ?? 'Agent');
}

/**
 * Every action the trail can hold, by namespace. Register new ones in the
 * WorkOS dashboard under Audit Logs → Events before the mirror accepts them.
 */
export const AUDIT_ACTIONS = {
  work_item: [
    'created',
    'updated',
    'deleted',
    'stage_moved',
    'transition_rejected',
    'comment_created',
    'comment_edited',
    'comment_deleted',
    'comment_mentioned',
    'labels_reconciled',
  ],
  run: ['started', 'ended', 'approved', 'dismissed', 'retry'],
  git: ['commit', 'push', 'pr_opened'],
  agent: ['commit', 'push', 'pr_opened', 'signaled'],
  intake: ['config_updated', 'binding_updated'],
} as const;

export type AuditNamespace = keyof typeof AUDIT_ACTIONS;

export type AuditAction = {
  [Namespace in AuditNamespace]: `factory.${Namespace}.${(typeof AUDIT_ACTIONS)[Namespace][number]}`;
}[AuditNamespace];

export function isAuditNamespace(value: string): value is AuditNamespace {
  return Object.hasOwn(AUDIT_ACTIONS, value);
}

export function auditNamespaces(): AuditNamespace[] {
  return Object.keys(AUDIT_ACTIONS).filter(isAuditNamespace);
}

export function parseAuditAction(action: string): { namespace: AuditNamespace; leaf: string } | undefined {
  const [, namespace, leaf] = action.split('.');
  return namespace !== undefined && leaf !== undefined && isAuditNamespace(namespace) ? { namespace, leaf } : undefined;
}

export function isAuditAction(value: string): value is AuditAction {
  const parsed = parseAuditAction(value);
  return parsed !== undefined && AUDIT_ACTIONS[parsed.namespace].some(leaf => leaf === parsed.leaf);
}

export function auditActionsInNamespaces(namespaces: readonly AuditNamespace[]): string[] {
  return namespaces.flatMap(namespace => AUDIT_ACTIONS[namespace].map(leaf => `factory.${namespace}.${leaf}`));
}

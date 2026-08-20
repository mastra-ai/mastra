/**
 * The audit action taxonomy, shared by the server that records events and the
 * browser that filters them. Free of imports on purpose: the UI pulls this in
 * at runtime, and reaching it through the storage domain drags Node's `stream`
 * into the bundle.
 */

/**
 * Every action the Factory records, `factory.<namespace>.<verb>`. Register each
 * one in the WorkOS dashboard under Audit Logs → Events — the export mirror
 * drops what it does not know. Recording is typed against this list and the
 * audit UI derives its filters from it: an action missing here will not
 * compile, and one listed but never emitted shows up as an empty filter.
 */
export const AUDIT_ACTIONS = [
  'factory.work_item.created',
  'factory.work_item.updated',
  'factory.work_item.stage_moved',
  'factory.work_item.deleted',
  'factory.work_item.transition_rejected',
  'factory.run.started',
  'factory.run.approved',
  'factory.run.dismissed',
  'factory.git.commit',
  'factory.git.push',
  'factory.git.pr_opened',
  'factory.agent.commit',
  'factory.agent.push',
  'factory.intake.config_updated',
  'factory.intake.binding_updated',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type NamespaceOf<Action extends string> = Action extends `factory.${infer Namespace}.${string}` ? Namespace : never;

/** The middle segment of an action — what it acted on. */
export type AuditNamespace = NamespaceOf<AuditAction>;

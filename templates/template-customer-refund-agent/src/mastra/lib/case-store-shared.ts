import { createHash } from "node:crypto";
import type {
  CaseFeedback,
  CaseMessage,
  SupportCase,
} from "../domain/support-case.ts";
import { supportCaseSchema } from "../domain/support-case.ts";
import {
  bindingsForCase,
  sameBinding,
  type ProviderBinding,
} from "../providers/contracts.ts";

export type DispatchState =
  "pending" | "claimed" | "completed" | "suspended" | "failed";
export type OutboxState =
  | "pending"
  | "claimed"
  | "started"
  | "delivered"
  | "failed"
  | "uncertain"
  | "superseded";
export type OutboxOperation = "reply" | "note" | "status" | "ticket";
export interface OutboxRecord {
  id: string;
  caseId: string;
  binding: ProviderBinding;
  body: string;
  status: string;
  operation?: OutboxOperation;
  /** Hash of the immutable operation payload.  A retry cannot mutate it. */
  payloadFingerprint?: string;
  nextAttemptAt?: string;
  state: OutboxState;
  attempts: number;
  receipt?: unknown;
  lastError?: string;
  leaseToken?: string;
  /** Immutable originating response correlation.  Legacy rows may be unknown. */
  originatingTurnId?: string;
  originatingRunId?: string;
  originatingTraceId?: string;
  correlationState?: "known" | "unknown";
}
export interface DispatchRecord {
  id: string;
  caseId: string;
  /** Immutable inbound turn this workflow run owns. */
  turnId: string;
  runId: string;
  state: DispatchState;
  attempts: number;
  /** Whether this dispatch had already crossed the durable start boundary. */
  wasStarted: boolean;
  leaseToken?: string;
}
export interface SupportTurnRecord {
  id: string;
  eventId: string;
  sequence: number;
  state: string;
  runId?: string;
  commandFingerprint?: string;
  message?: CaseMessage;
  outcome?: Record<string, unknown>;
}
export interface FeedbackRecord {
  id: string;
  caseId: string;
  feedback: CaseFeedback;
  attributionState?: "known" | "legacy-unknown";
}
/**
 * An authenticated staff investigation is observability bookkeeping, not a
 * support turn or a case-state transition.  Its identifiers are server-derived
 * correlation keys only; request/response content is never retained here.
 */
export interface SupervisorExecutionRecord {
  id: string;
  tenantId: string;
  caseId: string;
  threadId: string;
  actorId: string;
  runId: string;
  traceId?: string;
  state: "completed" | "failed";
  createdAt: string;
}
export const retentionDefaults = {
  rawPayloadDays: 7,
  caseDays: 90,
  traceDays: 30,
  financialAuditDays: 365,
} as const;
export interface RetentionPolicy {
  rawPayloadDays: number;
  caseDays: number;
  traceDays: number;
  financialAuditDays: number;
}
export function retentionPolicyFromEnvironment(): RetentionPolicy {
  const bounded = (name: string, fallback: number, maximum: number) => {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`${name} must be an integer from 1 through ${maximum}.`);
    return value;
  };
  return {
    rawPayloadDays: bounded(
      "SUPPORT_RETENTION_RAW_PAYLOAD_DAYS",
      retentionDefaults.rawPayloadDays,
      retentionDefaults.rawPayloadDays,
    ),
    caseDays: bounded(
      "SUPPORT_RETENTION_CASE_DAYS",
      retentionDefaults.caseDays,
      retentionDefaults.caseDays,
    ),
    traceDays: bounded(
      "SUPPORT_RETENTION_TRACE_DAYS",
      retentionDefaults.traceDays,
      retentionDefaults.traceDays,
    ),
    financialAuditDays: bounded(
      "SUPPORT_RETENTION_FINANCIAL_AUDIT_DAYS",
      retentionDefaults.financialAuditDays,
      retentionDefaults.financialAuditDays,
    ),
  };
}
export interface RetentionResult {
  rawPayloadsRedacted: number;
  casesRedacted: number;
  tracesRedacted: number;
  supervisorExecutionsDeleted: number;
  auditsDeleted: number;
  messagesDeleted: number;
  turnsRedacted: number;
  outboxRecordsRedacted: number;
  dispatchesExpired: number;
  decisionsRedacted: number;
  actionsRedacted: number;
  feedbackDeleted: number;
  auditPayloadsRedacted: number;
  financialReasonsRedacted: number;
  mastraMessagesDeleted: number;
  mastraSpansDeleted: number;
  /** Pending cases older than the case window are closed without an effect. */
  pendingCasesExpired: number;
  /** Inbound snapshots are enumerated by their real storage name and age. */
  rawWorkflowSnapshotBefore: string;
  /** Expired app cases identify native snapshots even before a decision exists. */
  expiredCaseIds: string[];
  /** Mastra workflow runs whose snapshots can be removed after case redaction. */
  expiredWorkflowRunIds: string[];
}
export class StaleCaseWriteError extends Error {
  constructor(id: string) {
    super(`Stale case write rejected for ${id}.`);
  }
}

export function now() {
  return new Date().toISOString();
}

// Production workers always lease a dispatch for 30 seconds. The narrowly
// test-only override lets integration coverage cross that boundary without
// changing the deployed lifetime.
export function dispatchLeaseDurationMs() {
  if (process.env.NODE_ENV !== "test") return 30_000;
  const configured = Number(process.env.SUPPORT_TEST_DISPATCH_LEASE_MS);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : 30_000;
}

export function dispatchLeaseUntil() {
  return new Date(Date.now() + dispatchLeaseDurationMs()).toISOString();
}
export function parse(row: Record<string, unknown>): SupportCase {
  const value: unknown = JSON.parse(String(row.data));
  return supportCaseSchema.parse(value);
}

/**
 * Migrations and retention repair may read historical rows before normalizing
 * old metadata. Runtime operations must always use `parse` above.
 */
export function parseLegacyCase(row: Record<string, unknown>): SupportCase {
  const value: unknown = JSON.parse(String(row.data));
  if (value && typeof value === "object") return value as SupportCase;
  throw new Error("Persisted legacy support case is not an object.");
}
export function scopedEventId(binding: ProviderBinding, eventId: string) {
  // `support_events.id` is the physical primary key as well as the logical
  // event key.  Qualify it too: the logical uniqueness constraint is scoped,
  // and a global physical id must not reintroduce the old collision.
  return `event_${createHash("sha256")
    .update(
      JSON.stringify([binding.tenantId, binding.providerAccountId, eventId]),
    )
    .digest("hex")}`;
}

/** Provider message IDs are only unique within their conversation/account.
 * The app-owned retention mirror has one physical primary key, so qualify its
 * storage key without changing the domain-visible message identity. */
export function scopedMessageId(caseId: string, messageId: string) {
  return `message_${createHash("sha256")
    .update(JSON.stringify([caseId, messageId]))
    .digest("hex")}`;
}

export function isRetentionTombstone(supportCase: SupportCase) {
  return supportCase.metadata.retentionRedactedAt !== undefined;
}

/**
 * A terminal financial operation must remain a replay barrier after its
 * provider identifiers age out.  The key and fingerprint live in the table
 * columns; this deliberately contains no provider, customer, order, payment,
 * refund, or subscription data.
 */
export const financialRetentionTombstone = Object.freeze({
  retention: "terminal-financial-effect",
});

export function isFinancialRetentionTombstone(effect: unknown) {
  return (
    !!effect &&
    typeof effect === "object" &&
    !Array.isArray(effect) &&
    Object.keys(effect).length === 1 &&
    (effect as { retention?: unknown }).retention ===
      financialRetentionTombstone.retention
  );
}

export function financialRetentionTombstoneError() {
  return new Error(
    "A retained terminal financial tombstone blocks replay or a new provider effect.",
  );
}

export function caseBinding(case_: SupportCase): ProviderBinding {
  return bindingsForCase(case_).support;
}

/** New records always carry all four independently addressable bindings. */
export function withBindings(case_: SupportCase): SupportCase {
  const bindings = bindingsForCase(case_);
  return supportCaseSchema.parse({
    ...case_,
    metadata: {
      ...case_.metadata,
      providerBinding: bindings.support,
      providerBindings: bindings,
    },
  });
}

export function assertBindingsUnchanged(
  current: SupportCase,
  updated: SupportCase,
) {
  const before = bindingsForCase(current);
  const after = bindingsForCase(updated);
  for (const port of [
    "support",
    "commerce",
    "transactions",
    "knowledge",
  ] as const)
    if (!sameBinding(before[port], after[port]))
      throw new Error(`Persisted ${port} provider binding is immutable.`);
}

export function outboxFingerprint(
  binding: ProviderBinding,
  operation: OutboxOperation,
  body: string,
  status: string,
) {
  return createHash("sha256")
    .update(JSON.stringify({ binding, operation, body, status }))
    .digest("hex");
}

export function outbox(
  row: Record<string, unknown>,
  state: OutboxState,
): OutboxRecord {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    binding: JSON.parse(String(row.binding)) as ProviderBinding,
    body: String(row.body),
    status: String(row.status),
    operation: ["reply", "note", "status", "ticket"].includes(
      String(row.operation),
    )
      ? (String(row.operation) as OutboxOperation)
      : "reply",
    payloadFingerprint: row.payload_fingerprint
      ? String(row.payload_fingerprint)
      : undefined,
    nextAttemptAt: row.next_attempt_at
      ? String(row.next_attempt_at)
      : undefined,
    state,
    attempts: Number(row.attempts) + 1,
    receipt: row.receipt ? JSON.parse(String(row.receipt)) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
    leaseToken: row.lease_token ? String(row.lease_token) : undefined,
    originatingTurnId: row.originating_turn_id
      ? String(row.originating_turn_id)
      : undefined,
    originatingRunId: row.originating_run_id
      ? String(row.originating_run_id)
      : undefined,
    originatingTraceId: row.originating_trace_id
      ? String(row.originating_trace_id)
      : undefined,
    correlationState:
      String(row.correlation_state) === "known" ? "known" : "unknown",
  };
}

export function stripeAttempt(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    tenantId: String(row.tenant_id),
    providerAccountId: String(row.provider_account_id),
    fingerprint: String(row.command_fingerprint),
    idempotencyKey: String(row.idempotency_key),
    dispatchId: String(row.dispatch_id),
    leaseToken: String(row.lease_token),
    status: String(row.status) as
      | "prepared"
      | "pending"
      | "succeeded"
      | "failed"
      | "unknown"
      | "quarantined",
    refundId: row.refund_id ? String(row.refund_id) : undefined,
    providerStatus: row.provider_status
      ? String(row.provider_status)
      : undefined,
    turnId: row.turn_id ? String(row.turn_id) : undefined,
    command: row.command_data
      ? JSON.parse(String(row.command_data))
      : undefined,
    stripeRequest: row.stripe_request_data
      ? JSON.parse(String(row.stripe_request_data))
      : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    nextAttemptAt: row.next_attempt_at
      ? String(row.next_attempt_at)
      : undefined,
    reconcileLeaseToken: row.reconcile_lease_token
      ? String(row.reconcile_lease_token)
      : undefined,
    terminalAt: row.terminal_at ? String(row.terminal_at) : undefined,
    reconcileAttempts: Number(row.reconcile_attempts ?? 0),
  };
}

import type { Client } from "@libsql/client";
import type { SupportCase } from "../domain/support-case";
import type { CustomerFinancialRequest } from "../domain/support-case";
import {
  now,
  parse,
  isFinancialRetentionTombstone,
  financialRetentionTombstoneError,
  StaleCaseWriteError,
} from "./case-store-shared";
import { legacyAmountToMoney, money, moneyToLegacyAmount } from "./money";

type FinancialCommand = {
  binding?: { providerKind?: unknown };
  amount?: { minor?: unknown; currency?: unknown } | number;
  currency?: unknown;
  orderId?: unknown;
  customerId?: unknown;
  subscriptionId?: unknown;
  idempotencyKey?: unknown;
};

function safeReceipt(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(String(value));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** A durable idempotency row may mean a pending recovery, a failed attempt, or
 * a retention tombstone. Only a receipt that matches its immutable command is
 * a customer-visible completed transaction. */
export function customerReceiptState(
  kind: string,
  command: FinancialCommand,
  receipt: Record<string, unknown> | undefined,
): "executed" | "failed" | "unknown" | undefined {
  if (!receipt || receipt.retention) return undefined;
  const providerStatus = receipt.status;
  if (providerStatus === "failed") return "failed";
  if (providerStatus === "pending") return undefined;
  if (providerStatus === "unknown") return "unknown";
  const amount = command.amount;
  const expectedCurrency =
    typeof amount === "object" && amount !== null
      ? amount.currency
      : command.currency;
  let expected;
  try {
    expected =
      typeof amount === "object" && amount !== null
        ? typeof amount.minor === "number" &&
          typeof expectedCurrency === "string"
          ? money(expectedCurrency, amount.minor)
          : undefined
        : typeof amount === "number" && typeof expectedCurrency === "string"
          ? legacyAmountToMoney(amount, expectedCurrency)
          : undefined;
  } catch {
    return "unknown";
  }
  const receivedAmount = receipt.amount as
    { minor?: unknown; currency?: unknown } | undefined;
  const matchingMoney =
    expected !== undefined &&
    typeof receivedAmount?.minor === "number" &&
    receivedAmount.minor === expected.minor &&
    receivedAmount.currency === expected.currency;
  const matchingRequest =
    receipt.idempotencyKey === command.idempotencyKey &&
    (kind === "refund-command"
      ? receipt.orderId === command.orderId
      : receipt.customerId === command.customerId &&
        receipt.subscriptionId === command.subscriptionId);
  if (!matchingMoney || !matchingRequest) return "unknown";
  // Stripe's asynchronous receipt must explicitly settle. The local provider
  // has a synchronous, validated receipt without a status field.
  if (command.binding?.providerKind === "stripe")
    return providerStatus === "succeeded" ? "executed" : "unknown";
  return providerStatus === undefined || providerStatus === "succeeded"
    ? "executed"
    : "unknown";
}

export class CaseStoreActions {
  constructor(private readonly client: Client) {}
  async saveAction(
    caseId: string,
    kind: string,
    fingerprint: string,
    data: unknown,
  ) {
    await this.client.execute({
      sql: "INSERT OR IGNORE INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        `action_${crypto.randomUUID()}`,
        caseId,
        kind,
        fingerprint,
        JSON.stringify(data),
        now(),
      ],
    });
  }
  /** Atomically claim one verified Stripe event. A completed receipt is an
   * acknowledgement-only replay; an unexpired lease asks the provider to retry
   * later without starting a second reconciliation. */
  async claimStripeWebhookEvent(
    eventId: string,
  ): Promise<
    | { state: "claimed"; leaseToken: string }
    | { state: "completed" }
    | { state: "in-progress" }
  > {
    const tx = await this.client.transaction("write");
    const claimedAt = now();
    const leaseUntil = new Date(Date.now() + 30_000).toISOString();
    const leaseToken = crypto.randomUUID();
    try {
      const existing = await tx.execute({
        sql: "SELECT state, lease_until FROM support_stripe_webhook_receipts WHERE event_id = ?",
        args: [eventId],
      });
      const row = existing.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await tx.execute({
          sql: "INSERT INTO support_stripe_webhook_receipts(event_id, state, lease_token, lease_until, created_at, updated_at) VALUES (?, 'processing', ?, ?, ?, ?)",
          args: [eventId, leaseToken, leaseUntil, claimedAt, claimedAt],
        });
        await tx.commit();
        return { state: "claimed", leaseToken };
      }
      if (String(row.state) === "completed") {
        await tx.rollback();
        return { state: "completed" };
      }
      if (
        String(row.state) === "processing" &&
        typeof row.lease_until === "string" &&
        row.lease_until > claimedAt
      ) {
        await tx.rollback();
        return { state: "in-progress" };
      }
      const recovered = await tx.execute({
        sql: "UPDATE support_stripe_webhook_receipts SET state = 'processing', lease_token = ?, lease_until = ?, updated_at = ? WHERE event_id = ? AND state <> 'completed'",
        args: [leaseToken, leaseUntil, claimedAt, eventId],
      });
      if (Number(recovered.rowsAffected) !== 1)
        throw new Error("Stripe webhook receipt claim was lost.");
      await tx.commit();
      return { state: "claimed", leaseToken };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Completion is deliberately separate from receipt creation: a process can
   * die after claiming, and a later signed delivery can recover the expired
   * lease instead of treating unprocessed work as a duplicate. */
  async completeStripeWebhookEvent(eventId: string, leaseToken: string) {
    const completedAt = now();
    const result = await this.client.execute({
      sql: "UPDATE support_stripe_webhook_receipts SET state = 'completed', lease_token = NULL, lease_until = NULL, completed_at = ?, updated_at = ? WHERE event_id = ? AND state = 'processing' AND lease_token = ?",
      args: [completedAt, completedAt, eventId, leaseToken],
    });
    return Number(result.rowsAffected) === 1;
  }
  /** Do not persist provider error details here. A failed receipt is immediately
   * recoverable by the next signed delivery and carries no raw webhook data. */
  async failStripeWebhookEvent(eventId: string, leaseToken: string) {
    const result = await this.client.execute({
      sql: "UPDATE support_stripe_webhook_receipts SET state = 'failed', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE event_id = ? AND state = 'processing' AND lease_token = ?",
      args: [now(), eventId, leaseToken],
    });
    return Number(result.rowsAffected) === 1;
  }
  /** Atomically records the sole authorized decision for a command. The
   * caller must invoke this before native approval/resume; a losing concurrent
   * request cannot mutate the case projection or execute the effect. */
  async recordApprovalDecision(input: {
    caseId: string;
    turnId?: string;
    commandFingerprint: string;
    principalId: string;
    approved: boolean;
    note?: string;
    serviceProblemConfirmed?: true;
    nativeRunId?: string;
    nativeToolCallId?: string;
  }): Promise<{ won: boolean; decisionId?: string }> {
    const tx = await this.client.transaction("write");
    try {
      const command = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind IN ('refund-command', 'subscription-credit-command') AND fingerprint = ?",
        args: [input.caseId, input.commandFingerprint],
      });
      if (!command.rows[0])
        throw new Error("Approval command is missing or has changed.");
      const currentResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = currentResult.rows[0];
      if (!row) throw new Error(`Support case not found: ${input.caseId}`);
      const current = parse(row as Record<string, unknown>);
      if (current.status !== "waiting_approval")
        throw new Error("Case is not waiting for approval.");
      const turnId =
        input.turnId ??
        current.metadata.activeTurnId ??
        `legacy:${input.caseId}`;
      const existing = await tx.execute({
        sql: "SELECT id FROM support_decisions WHERE case_id = ? AND turn_id = ? AND command_fingerprint = ?",
        args: [input.caseId, turnId, input.commandFingerprint],
      });
      if (existing.rows[0]) {
        await tx.rollback();
        return { won: false };
      }
      const decisionId = `decision_${crypto.randomUUID()}`;
      const updated: SupportCase = {
        ...current,
        approval: {
          approved: input.approved,
          approverId: input.principalId,
          note: input.note,
          serviceProblemConfirmed: input.serviceProblemConfirmed,
        },
        status: "processing",
        updatedAt: now(),
      };
      await tx.execute({
        sql: "INSERT INTO support_decisions(id, case_id, turn_id, command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          decisionId,
          input.caseId,
          turnId,
          input.commandFingerprint,
          input.nativeRunId ?? null,
          input.nativeToolCallId ?? null,
          input.principalId,
          input.approved ? 1 : 0,
          input.note ?? null,
          now(),
        ],
      });
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [
          JSON.stringify(updated),
          updated.updatedAt,
          input.caseId,
          Number(row.version ?? 1),
        ],
      });
      if (Number(write.rowsAffected) !== 1)
        throw new StaleCaseWriteError(input.caseId);
      await tx.execute({
        sql: "INSERT INTO support_audit(id, case_id, kind, actor_id, data, created_at) VALUES (?, ?, 'approval-decision', ?, ?, ?)",
        args: [
          `audit_${crypto.randomUUID()}`,
          input.caseId,
          input.principalId,
          JSON.stringify({
            decisionId,
            commandFingerprint: input.commandFingerprint,
            approved: input.approved,
            serviceProblemConfirmed: input.serviceProblemConfirmed,
          }),
          now(),
        ],
      });
      await tx.commit();
      return { won: true, decisionId };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async approvalDecision(caseId: string, turnId?: string) {
    const result = await this.client.execute({
      sql: "SELECT command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, turn_id FROM support_decisions WHERE case_id = ? AND (? IS NULL OR turn_id = ?) ORDER BY created_at DESC LIMIT 1",
      args: [caseId, turnId ?? null, turnId ?? null],
    });
    const row = result.rows[0];
    return row
      ? {
          commandFingerprint: String(row.command_fingerprint),
          nativeRunId: row.native_run_id
            ? String(row.native_run_id)
            : undefined,
          nativeToolCallId: row.native_tool_call_id
            ? String(row.native_tool_call_id)
            : undefined,
          principalId: String(row.principal_id),
          approved: Number(row.approved) === 1,
          turnId: String(row.turn_id),
        }
      : undefined;
  }
  /**
   * This read model is intentionally assembled from immutable action/decision
   * rows and the receipt ledger. A later customer follow-up cannot erase an
   * earlier request. It returns only the fields the customer can understand.
   */
  async customerFinancialRequests(
    caseIds: string[],
  ): Promise<CustomerFinancialRequest[]> {
    if (!caseIds.length) return [];
    const placeholders = caseIds.map(() => "?").join(", ");
    const rows = await this.client.execute({
      sql: `SELECT a.case_id, a.kind, a.fingerprint, a.data, a.created_at,
          t.id AS turn_id, d.approved AS approved, i.effect AS receipt,
          r.status AS refund_attempt_status, r.idempotency_key AS refund_attempt_key,
          c.status AS credit_attempt_status, c.idempotency_key AS credit_attempt_key,
          EXISTS(SELECT 1 FROM support_actions f WHERE f.case_id = a.case_id
            AND f.fingerprint = a.fingerprint
            AND f.kind IN ('refund-failure', 'subscription-credit-failure')) AS failed,
          EXISTS(SELECT 1 FROM support_actions u WHERE u.case_id = a.case_id
            AND u.fingerprint = a.fingerprint AND u.kind = 'refund-uncertain') AS uncertain
        FROM support_actions a
        JOIN support_turns t ON t.case_id = a.case_id
          AND t.command_fingerprint = a.fingerprint
        LEFT JOIN support_decisions d ON d.case_id = a.case_id
          AND d.turn_id = t.id AND d.command_fingerprint = a.fingerprint
        LEFT JOIN support_idempotency i ON i.fingerprint = a.fingerprint
        LEFT JOIN support_stripe_refund_attempts r ON a.kind = 'refund-command'
          AND r.case_id = a.case_id AND r.turn_id = t.id
          AND r.command_fingerprint = a.fingerprint
        LEFT JOIN support_stripe_subscription_credit_attempts c
          ON a.kind = 'subscription-credit-command' AND c.case_id = a.case_id
          AND c.turn_id = t.id AND c.command_fingerprint = a.fingerprint
        WHERE a.case_id IN (${placeholders})
          AND a.kind IN ('refund-command', 'subscription-credit-command')
        ORDER BY a.created_at DESC`,
      args: caseIds,
    });
    return rows.rows.flatMap((row) => {
      let command: FinancialCommand;
      try {
        command = JSON.parse(String(row.data)) as FinancialCommand;
      } catch {
        return [];
      }
      if (
        typeof command.amount !== "object" &&
        (typeof command.amount !== "number" ||
          !Number.isFinite(command.amount) ||
          command.amount <= 0)
      )
        return [];
      const commandAmount = command.amount as
        number | { minor?: unknown; currency?: unknown };
      const currency =
        typeof command.currency === "string"
          ? command.currency
          : typeof commandAmount === "object" &&
              typeof commandAmount.currency === "string"
            ? commandAmount.currency
            : undefined;
      let amount: number | undefined;
      try {
        amount =
          typeof commandAmount === "number"
            ? currency
              ? moneyToLegacyAmount(
                  legacyAmountToMoney(commandAmount, currency),
                )
              : undefined
            : typeof commandAmount.minor === "number" && currency
              ? moneyToLegacyAmount(money(currency, commandAmount.minor))
              : undefined;
      } catch {
        return [];
      }
      if (amount === undefined || !currency) return [];
      const receipt = safeReceipt(row.receipt);
      const receiptStatus = customerReceiptState(
        String(row.kind),
        command,
        receipt,
      );
      const exactAttemptStatus =
        String(row.kind) === "refund-command"
          ? row.refund_attempt_key === command.idempotencyKey
            ? String(row.refund_attempt_status ?? "")
            : undefined
          : row.credit_attempt_key === command.idempotencyKey
            ? String(row.credit_attempt_status ?? "")
            : undefined;
      const status =
        row.approved === null || row.approved === undefined
          ? "pending_approval"
          : Number(row.approved) === 0
            ? "rejected"
            : receiptStatus === "executed"
              ? "executed"
              : receiptStatus === "failed"
                ? "failed"
                : receiptStatus === "unknown"
                  ? "unknown"
                  : exactAttemptStatus === "failed"
                    ? "failed"
                    : exactAttemptStatus === "unknown" ||
                        exactAttemptStatus === "quarantined"
                      ? "unknown"
                      : Number(row.uncertain) > 0
                        ? "unknown"
                        : Number(row.failed) > 0
                          ? "failed"
                          : "processing";
      return [
        {
          caseId: String(row.case_id),
          turnId: String(row.turn_id),
          type:
            String(row.kind) === "subscription-credit-command"
              ? "subscription_credit"
              : "refund",
          amount,
          currency,
          status,
          requestedAt: String(row.created_at),
        },
      ];
    });
  }
  /** Monitoring reads immutable decision rows rather than a mutable case
   * projection, so a later follow-up cannot erase earlier approval outcomes. */
  async monitoringDecisions(caseIds: string[], actionKind = "refund-command") {
    if (!caseIds.length)
      return [] as Array<{ caseId: string; turnId: string; approved: boolean }>;
    const placeholders = caseIds.map(() => "?").join(", ");
    const result = await this.client.execute({
      sql: `SELECT d.case_id, d.turn_id, d.approved FROM support_decisions d JOIN support_turns t ON t.case_id = d.case_id AND t.id = d.turn_id JOIN support_actions a ON a.case_id = d.case_id AND a.fingerprint = t.command_fingerprint WHERE d.case_id IN (${placeholders}) AND a.kind = ? ORDER BY d.created_at`,
      args: [...caseIds, actionKind],
    });
    return result.rows.map((row) => ({
      caseId: String(row.case_id),
      turnId: String(row.turn_id),
      approved: Number(row.approved) === 1,
    }));
  }
  /** Separate failure counters intentionally do not collapse rejection,
   * workflow, financial, and delivery into one misleading error rate. */
  async monitoringOperationalFailures(caseIds: string[]) {
    if (!caseIds.length)
      return { rejectedDecisions: 0, workflow: 0, financial: 0, delivery: 0 };
    const placeholders = caseIds.map(() => "?").join(", ");
    const [decisions, workflow, financial, delivery] = await Promise.all([
      this.client.execute({
        sql: `SELECT COUNT(*) AS total FROM support_decisions WHERE approved = 0 AND case_id IN (${placeholders})`,
        args: caseIds,
      }),
      this.client.execute({
        // Exhausted retries deliberately become customer-visible escalations;
        // their immutable operationalFailure is still a workflow failure.
        sql: `SELECT COUNT(*) AS total FROM support_turns WHERE (state = 'failed' OR (state = 'escalated' AND json_extract(outcome_data, '$.operationalFailure.disposition') = 'escalate')) AND case_id IN (${placeholders})`,
        args: caseIds,
      }),
      this.client.execute({
        // A workflow/delivery failure after a successful refund is not a
        // financial failure. Only an explicitly durable provider failure is.
        sql: `SELECT COUNT(*) AS total FROM support_actions WHERE kind IN ('refund-failure', 'subscription-credit-failure') AND case_id IN (${placeholders})`,
        args: caseIds,
      }),
      this.client.execute({
        sql: `SELECT COUNT(*) AS total FROM support_outbox WHERE state = 'failed' AND case_id IN (${placeholders})`,
        args: caseIds,
      }),
    ]);
    const total = (result: { rows: Array<Record<string, unknown>> }) =>
      Number(result.rows[0]?.total ?? 0);
    return {
      rejectedDecisions: total(decisions),
      workflow: total(workflow),
      financial: total(financial),
      delivery: total(delivery),
    };
  }
  async monitoringFinancialFailures(caseIds: string[], actionKind = "refund") {
    if (!caseIds.length) return 0;
    const result = await this.client.execute({
      sql: `SELECT COUNT(*) AS total FROM support_actions WHERE kind = ? AND case_id IN (${caseIds.map(() => "?").join(", ")})`,
      args: [`${actionKind}-failure`, ...caseIds],
    });
    return Number(result.rows[0]?.total ?? 0);
  }
  /** Decisions are durable authority. A worker uses this queue after an HTTP
   * process dies between recording the one decision and resuming Mastra. */
  /** Native resume is driven by the one durable decision, whether it approved
   * or declined the command.  The dispatch lease is the fence: a worker only
   * reads rows that have not already been claimed for resume. */
  async nativeDecisionsNeedingRecovery(limit = 10) {
    const rows = await this.client.execute({
      sql: "SELECT d.case_id, d.turn_id, d.command_fingerprint, d.native_run_id, d.native_tool_call_id, d.principal_id, d.approved, d.note, c.data, p.id AS dispatch_id, p.run_id AS workflow_run_id, p.state AS dispatch_state FROM support_decisions d JOIN support_cases c ON c.id = d.case_id LEFT JOIN support_dispatch p ON p.case_id = d.case_id AND p.turn_id = d.turn_id WHERE d.native_run_id IS NOT NULL AND d.native_tool_call_id IS NOT NULL AND (p.state = 'suspended' OR p.state IS NULL OR (p.state = 'claimed' AND p.lease_until < ?)) ORDER BY d.created_at LIMIT ?",
      args: [now(), limit],
    });
    return rows.rows.map((row) => ({
      caseId: String(row.case_id),
      turnId: String(row.turn_id),
      fingerprint: String(row.command_fingerprint),
      nativeRunId: String(row.native_run_id),
      nativeToolCallId: String(row.native_tool_call_id),
      principalId: String(row.principal_id),
      approved: Number(row.approved) === 1,
      note: row.note ? String(row.note) : undefined,
      workflowRunId: row.workflow_run_id
        ? String(row.workflow_run_id)
        : undefined,
      supportCase: JSON.parse(String(row.data)) as SupportCase,
    }));
  }
  async getAction(caseId: string, kind: string, fingerprint: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = ? AND fingerprint = ?",
      args: [caseId, kind, fingerprint],
    });
    return result.rows[0] ? JSON.parse(String(result.rows[0].data)) : undefined;
  }
  async idempotency(key: string) {
    // Stripe's immutable attempt ledger is the authority for a financial
    // replay. A success effect can be written before a later provider failure
    // arrives, so never expose that stale row after the ledger terminalizes
    // failed/quarantined. Local effects have no Stripe attempt and retain the
    // original direct idempotency behavior.
    const refundLedger = await this.client.execute({
      sql: "SELECT status FROM support_stripe_refund_attempts WHERE idempotency_key = ?",
      args: [key],
    });
    const creditLedger = await this.client.execute({
      sql: "SELECT status FROM support_stripe_subscription_credit_attempts WHERE idempotency_key = ?",
      args: [key],
    });
    if (
      (refundLedger.rows[0] &&
        String(refundLedger.rows[0].status) !== "succeeded") ||
      (creditLedger.rows[0] &&
        String(creditLedger.rows[0].status) !== "succeeded")
    )
      return undefined;
    const result = await this.client.execute({
      sql: "SELECT fingerprint, effect FROM support_idempotency WHERE idempotency_key = ?",
      args: [key],
    });
    if (!result.rows[0]) return undefined;
    const effect = JSON.parse(String(result.rows[0].effect));
    if (isFinancialRetentionTombstone(effect))
      throw financialRetentionTombstoneError();
    return {
      fingerprint: String(result.rows[0].fingerprint),
      effect,
    };
  }
  /** Project one native tool receipt with its replay effect only while the
   * current immutable Stripe attempt still permits it. This reads the attempt
   * and case in the same write transaction, so a webhook finalizer cannot win
   * between a separate version read and a stale projection/effect write. */
}

import type { Client } from "@libsql/client";
import { structurallyEqual } from "./money";
import {
  bindingsForCase,
  type RefundCommand,
  type SubscriptionCancellationCommand,
  type SubscriptionCreditCommand,
} from "../providers/contracts";
import { canonicalConversationOwner } from "./case-store-cases";
import type { DispatchLeaseScope } from "./dispatch-lease-scope";
import {
  now,
  parse,
  withBindings,
  dispatchLeaseUntil,
  StaleCaseWriteError,
  DispatchRecord,
  DispatchState,
} from "./case-store-shared";

export class CaseStoreDispatch {
  constructor(private readonly client: Client) {}
  async claimDispatch(limit = 10): Promise<DispatchRecord[]> {
    const claimedAt = now();
    const exhausted = await this.client.execute({
      sql: "SELECT d.case_id, d.id FROM support_dispatch d WHERE d.state IN ('claimed', 'started') AND d.lease_until < ? AND d.attempts >= 3 AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = d.id AND r.reconcile_lease_until > ?)",
      args: [claimedAt, claimedAt],
    });
    for (const row of exhausted.rows) {
      const caseId = String(row.case_id);
      const tx = await this.client.transaction("write");
      try {
        const changed = await tx.execute({
          sql: "UPDATE support_dispatch SET state = 'failed', lease_until = NULL, lease_token = NULL, last_error = COALESCE(last_error, 'Dispatch lease exhausted after three attempts.'), updated_at = ? WHERE case_id = ? AND state IN ('claimed', 'started') AND lease_until < ? AND attempts >= 3 AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = support_dispatch.id AND r.reconcile_lease_until > ?)",
          args: [claimedAt, caseId, claimedAt, claimedAt],
        });
        if (Number(changed.rowsAffected) === 1) {
          const caseRow = await tx.execute({
            sql: "SELECT data, version FROM support_cases WHERE id = ?",
            args: [caseId],
          });
          if (caseRow.rows[0]) {
            const current = parse(caseRow.rows[0] as Record<string, unknown>);
            if (current.status !== "waiting_approval") {
              const updated = withBindings({
                ...current,
                status: "escalated" as const,
                escalationReason:
                  "Workflow recovery exhausted its durable lease attempts.",
                metadata: { ...current.metadata, workflowStatus: "escalated" },
                updatedAt: now(),
              });
              const write = await tx.execute({
                sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
                args: [
                  JSON.stringify(updated),
                  updated.updatedAt,
                  caseId,
                  Number(caseRow.rows[0].version ?? 1),
                ],
              });
              if (Number(write.rowsAffected) !== 1)
                throw new StaleCaseWriteError(caseId);
              await tx.execute({
                sql: "UPDATE support_turns SET state = 'escalated', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = (SELECT turn_id FROM support_dispatch WHERE id = ?)",
                args: [
                  JSON.stringify({
                    status: "escalated",
                    escalationReason:
                      "Workflow recovery exhausted its durable lease attempts.",
                    operationalFailure: {
                      disposition: "escalate",
                      recordedAt: now(),
                    },
                  }),
                  now(),
                  String(row.id),
                ],
              });
            }
          }
        }
        await tx.commit();
      } catch (error) {
        try {
          await tx.rollback();
        } catch {}
        throw error;
      }
    }
    const leaseUntil = dispatchLeaseUntil();
    const rows = await this.client.execute({
      sql: "SELECT candidate.* FROM support_dispatch AS candidate JOIN support_turns AS candidate_turn ON candidate_turn.id = candidate.turn_id WHERE (candidate.state = 'pending' OR (candidate.state IN ('claimed', 'started') AND candidate.lease_until < ?)) AND candidate.attempts < 3 AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = candidate.id AND r.reconcile_lease_until > ?) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS active WHERE active.case_id = candidate.case_id AND active.id <> candidate.id AND active.state IN ('claimed', 'started', 'suspended')) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS earlier JOIN support_turns AS earlier_turn ON earlier_turn.id = earlier.turn_id WHERE earlier.case_id = candidate.case_id AND earlier.state = 'pending' AND earlier_turn.sequence < candidate_turn.sequence) ORDER BY candidate.created_at, candidate_turn.sequence, candidate.id LIMIT ?",
      args: [claimedAt, claimedAt, limit],
    });
    const claimed: DispatchRecord[] = [];
    for (const row of rows.rows) {
      const leaseToken = crypto.randomUUID();
      const update = await this.client.execute({
        sql: "UPDATE support_dispatch AS candidate SET state = 'claimed', attempts = attempts + 1, lease_until = ?, lease_token = ?, updated_at = ? WHERE id = ? AND (state = 'pending' OR (state IN ('claimed', 'started') AND lease_until < ?)) AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = candidate.id AND r.reconcile_lease_until > ?) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS active WHERE active.case_id = candidate.case_id AND active.id <> candidate.id AND active.state IN ('claimed', 'started', 'suspended')) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS earlier JOIN support_turns AS earlier_turn ON earlier_turn.id = earlier.turn_id JOIN support_turns AS candidate_turn ON candidate_turn.id = candidate.turn_id WHERE earlier.case_id = candidate.case_id AND earlier.state = 'pending' AND earlier_turn.sequence < candidate_turn.sequence)",
        args: [
          leaseUntil,
          leaseToken,
          claimedAt,
          String(row.id),
          claimedAt,
          claimedAt,
        ],
      });
      if (Number(update.rowsAffected) === 1)
        claimed.push({
          id: String(row.id),
          caseId: String(row.case_id),
          turnId: String(row.turn_id),
          runId: String(row.run_id),
          state: "claimed",
          attempts: Number(row.attempts) + 1,
          wasStarted:
            String(row.state) === "started" || String(row.state) === "claimed",
          leaseToken,
        });
    }
    return claimed;
  }
  async renewDispatchLease(id: string, leaseToken: string) {
    const checkedAt = now();
    const updated = await this.client.execute({
      // Never let an old worker resurrect a lease after another worker can
      // legally reclaim it.  Renewal is a heartbeat, not a new claim.
      sql: "UPDATE support_dispatch SET lease_until = ?, updated_at = ? WHERE id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
      args: [dispatchLeaseUntil(), checkedAt, id, leaseToken, checkedAt],
    });
    return Number(updated.rowsAffected) === 1;
  }
  async hasDispatchLease(scope: DispatchLeaseScope) {
    const result = await this.client.execute({
      sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
      args: [
        scope.dispatchId,
        scope.caseId,
        scope.turnId,
        scope.leaseToken,
        now(),
      ],
    });
    return Boolean(result.rows[0]);
  }
  /**
   * This is the last durable authorization boundary before a Stripe refund
   * can create an effect.  It intentionally runs after remote preflight and
   * keeps the dispatch/reconciliation lease, immutable command/target,
   * originating turn, owner, and binding in one write transaction.
   *
   * A successful return is immediately followed by the provider POST.  Do
   * not add network work after this method in a caller.
   */
  async authorizeStripeRefundFirstEffect(input: {
    command: RefundCommand;
    request: { paymentIntentId: string; providerRefs: unknown[] };
    ownerId: string;
    dispatch?: DispatchLeaseScope;
    reconciliationLeaseToken?: string;
    validatePolicy: (
      tx: Awaited<ReturnType<Client["transaction"]>>,
    ) => Promise<void>;
  }) {
    if (
      (input.dispatch === undefined) ===
      (input.reconciliationLeaseToken === undefined)
    )
      throw new Error(
        "Refund first-effect authorization requires exactly one current lease.",
      );
    const tx = await this.client.transaction("write");
    try {
      const command = input.command;
      const attemptResult = await tx.execute({
        sql: "SELECT * FROM support_stripe_refund_attempts WHERE idempotency_key = ? AND command_fingerprint = ?",
        args: [command.idempotencyKey, command.fingerprint],
      });
      const attempt = attemptResult.rows[0] as
        Record<string, unknown> | undefined;
      const caseResult = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [command.approvalCaseId],
      });
      const supportCase = caseResult.rows[0]
        ? parse({ data: caseResult.rows[0].data })
        : undefined;
      const actionResult = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'refund-command' AND fingerprint = ?",
        args: [command.approvalCaseId, command.fingerprint],
      });
      const immutable = actionResult.rows[0]
        ? JSON.parse(String(actionResult.rows[0].data))
        : undefined;
      const turnResult = await tx.execute({
        sql: "SELECT command_fingerprint FROM support_turns WHERE id = ? AND case_id = ?",
        args: [String(attempt?.turn_id ?? ""), command.approvalCaseId],
      });
      const request = attempt?.stripe_request_data
        ? JSON.parse(String(attempt.stripe_request_data))
        : undefined;
      const canonicalOwner = supportCase
        ? await canonicalConversationOwner(tx, {
            caseId: command.approvalCaseId,
            binding: bindingsForCase(supportCase).support,
          })
        : undefined;
      const ownerCurrent =
        supportCase &&
        canonicalOwner === input.ownerId &&
        supportCase.metadata.ownerId === canonicalOwner;
      const commandCurrent =
        attempt &&
        ["prepared", "unknown"].includes(String(attempt.status)) &&
        String(attempt.case_id) === command.approvalCaseId &&
        String(attempt.tenant_id) === command.binding.tenantId &&
        String(attempt.provider_account_id) ===
          command.binding.providerAccountId &&
        String(attempt.command_fingerprint) === command.fingerprint &&
        structurallyEqual(
          attempt.command_data
            ? JSON.parse(String(attempt.command_data))
            : undefined,
          command,
        ) &&
        structurallyEqual(request, input.request) &&
        structurallyEqual(immutable, command) &&
        String(turnResult.rows[0]?.command_fingerprint ?? "") ===
          command.fingerprint &&
        supportCase !== undefined &&
        structurallyEqual(
          bindingsForCase(supportCase).transactions,
          command.binding,
        ) &&
        ownerCurrent;
      let leaseCurrent = false;
      if (input.dispatch) {
        const dispatch = await tx.execute({
          sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
          args: [
            input.dispatch.dispatchId,
            input.dispatch.caseId,
            input.dispatch.turnId,
            input.dispatch.leaseToken,
            now(),
          ],
        });
        leaseCurrent =
          Boolean(dispatch.rows[0]) &&
          String(attempt?.dispatch_id ?? "") === input.dispatch.dispatchId &&
          String(attempt?.lease_token ?? "") === input.dispatch.leaseToken &&
          String(attempt?.turn_id ?? "") === input.dispatch.turnId &&
          supportCase?.metadata.activeTurnId === input.dispatch.turnId;
      } else if (input.reconciliationLeaseToken) {
        leaseCurrent =
          String(attempt?.reconcile_lease_token ?? "") ===
            input.reconciliationLeaseToken &&
          Date.parse(String(attempt?.reconcile_lease_until ?? "")) > Date.now();
      }
      if (!commandCurrent || !leaseCurrent) {
        await tx.rollback();
        return false;
      }
      // The published policy evidence is immutable, but the deterministic
      // case policy can become more restrictive while a provider preflight is
      // in flight. A stale worker must observe that current prohibition at
      // the same transaction boundary as its lease and command checks.
      if (supportCase.draft?.requiresEscalation) {
        await tx.rollback();
        return false;
      }
      await input.validatePolicy(tx);
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /**
   * The credit ledger is written before Stripe's balance-transaction POST so a
   * lost response can be reconciled safely. That durable preparation is not
   * authority for a new effect: re-check the immutable command, current lease,
   * and published policy in one transaction immediately before that first POST.
   */
  async authorizeStripeSubscriptionCreditFirstEffect(input: {
    command: SubscriptionCreditCommand;
    dispatch: DispatchLeaseScope;
    validatePolicy: (
      tx: Awaited<ReturnType<Client["transaction"]>>,
    ) => Promise<void>;
  }) {
    const tx = await this.client.transaction("write");
    try {
      const command = input.command;
      const attemptResult = await tx.execute({
        sql: "SELECT * FROM support_stripe_subscription_credit_attempts WHERE idempotency_key = ? AND command_fingerprint = ?",
        args: [command.idempotencyKey, command.fingerprint],
      });
      const attempt = attemptResult.rows[0] as
        Record<string, unknown> | undefined;
      const caseResult = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [command.approvalCaseId],
      });
      const supportCase = caseResult.rows[0]
        ? parse({ data: caseResult.rows[0].data })
        : undefined;
      const actionResult = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'subscription-credit-command' AND fingerprint = ?",
        args: [command.approvalCaseId, command.fingerprint],
      });
      const immutable = actionResult.rows[0]
        ? JSON.parse(String(actionResult.rows[0].data))
        : undefined;
      const turnResult = await tx.execute({
        sql: "SELECT command_fingerprint FROM support_turns WHERE id = ? AND case_id = ?",
        args: [String(attempt?.turn_id ?? ""), command.approvalCaseId],
      });
      const dispatch = await tx.execute({
        sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
        args: [
          input.dispatch.dispatchId,
          input.dispatch.caseId,
          input.dispatch.turnId,
          input.dispatch.leaseToken,
          now(),
        ],
      });
      const commandCurrent =
        attempt &&
        String(attempt.status) === "prepared" &&
        String(attempt.case_id) === command.approvalCaseId &&
        String(attempt.tenant_id) === command.binding.tenantId &&
        String(attempt.provider_account_id) ===
          command.binding.providerAccountId &&
        String(attempt.command_fingerprint) === command.fingerprint &&
        structurallyEqual(
          attempt.command_data
            ? JSON.parse(String(attempt.command_data))
            : undefined,
          command,
        ) &&
        structurallyEqual(immutable, command) &&
        String(turnResult.rows[0]?.command_fingerprint ?? "") ===
          command.fingerprint &&
        supportCase !== undefined &&
        structurallyEqual(
          bindingsForCase(supportCase).transactions,
          command.binding,
        );
      const leaseCurrent =
        Boolean(dispatch.rows[0]) &&
        String(attempt?.dispatch_id ?? "") === input.dispatch.dispatchId &&
        String(attempt?.lease_token ?? "") === input.dispatch.leaseToken &&
        String(attempt?.turn_id ?? "") === input.dispatch.turnId &&
        supportCase?.metadata.activeTurnId === input.dispatch.turnId;
      if (
        !commandCurrent ||
        !leaseCurrent ||
        !supportCase.approval?.serviceProblemConfirmed ||
        supportCase.draft?.requiresEscalation
      ) {
        await tx.rollback();
        return false;
      }
      await input.validatePolicy(tx);
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** The cancellation's durable claimed marker records a recovery obligation,
   * but is never permission to POST after preflight.  Re-check its current
   * workflow lease, command, turn, owner, and binding at the effect edge. */
  async authorizeSubscriptionCancellationFirstEffect(input: {
    command: SubscriptionCancellationCommand;
    dispatch: DispatchLeaseScope;
  }) {
    const tx = await this.client.transaction("write");
    try {
      const command = input.command;
      const attemptResult = await tx.execute({
        sql: "SELECT * FROM support_subscription_cancellation_attempts WHERE idempotency_key = ? AND fingerprint = ?",
        args: [command.idempotencyKey, command.fingerprint],
      });
      const attempt = attemptResult.rows[0] as
        Record<string, unknown> | undefined;
      const caseResult = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [command.caseId],
      });
      const supportCase = caseResult.rows[0]
        ? parse({ data: caseResult.rows[0].data })
        : undefined;
      const actionResult = await tx.execute({
        sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'subscription-cancellation-command' AND fingerprint = ?",
        args: [command.caseId, command.fingerprint],
      });
      const immutable = actionResult.rows[0]
        ? JSON.parse(String(actionResult.rows[0].data))
        : undefined;
      const turnResult = await tx.execute({
        sql: "SELECT command_fingerprint FROM support_turns WHERE id = ? AND case_id = ?",
        args: [command.turnId, command.caseId],
      });
      const dispatch = await tx.execute({
        sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
        args: [
          input.dispatch.dispatchId,
          input.dispatch.caseId,
          input.dispatch.turnId,
          input.dispatch.leaseToken,
          now(),
        ],
      });
      const current =
        Boolean(dispatch.rows[0]) &&
        attempt &&
        String(attempt.status) === "claimed" &&
        String(attempt.case_id) === command.caseId &&
        String(attempt.turn_id) === command.turnId &&
        String(attempt.tenant_id) === command.binding.tenantId &&
        String(attempt.provider_account_id) ===
          command.binding.providerAccountId &&
        String(attempt.subscription_id) === command.subscriptionId &&
        structurallyEqual(
          attempt.command_data
            ? JSON.parse(String(attempt.command_data))
            : undefined,
          command,
        ) &&
        structurallyEqual(immutable, command) &&
        String(turnResult.rows[0]?.command_fingerprint ?? "") ===
          command.fingerprint &&
        supportCase !== undefined &&
        supportCase.metadata.activeTurnId === command.turnId &&
        supportCase.metadata.ownerId === command.ownerId &&
        (await canonicalConversationOwner(tx, {
          caseId: command.caseId,
          binding: bindingsForCase(supportCase).support,
        })) === command.ownerId &&
        structurallyEqual(
          bindingsForCase(supportCase).transactions,
          command.binding,
        );
      if (!current) {
        await tx.rollback();
        return false;
      }
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async completeDispatch(
    id: string,
    state: Exclude<DispatchState, "pending" | "claimed">,
    error?: unknown,
    leaseToken?: string,
  ) {
    const tx = await this.client.transaction("write");
    try {
      const transitioned = await tx.execute({
        sql: `UPDATE support_dispatch SET state = ?, lease_until = NULL, lease_token = NULL, last_error = ?, updated_at = ? WHERE id = ?${leaseToken ? " AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?" : ""}`,
        args: leaseToken
          ? [state, error ? String(error) : null, now(), id, leaseToken, now()]
          : [state, error ? String(error) : null, now(), id],
      });
      // A stale worker must never overwrite the newer worker's turn outcome.
      if (Number(transitioned.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      await tx.execute({
        sql: "UPDATE support_turns SET state = CASE WHEN ? = 'completed' AND state IN ('resolved', 'escalated') THEN state ELSE ? END, updated_at = ? WHERE id = (SELECT turn_id FROM support_dispatch WHERE id = ?)",
        args: [state, state, now(), id],
      });
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Atomically project a fenced workflow failure to its dispatch and public
   * case.  Callers must not write the case first: a lease can change between
   * separate writes even when a heartbeat looked healthy moments earlier. */
  async failDispatchAndCase(
    id: string,
    caseId: string,
    error: unknown,
    leaseToken?: string,
    terminalStatus: "failed" | "escalated" = "failed",
  ) {
    const tx = await this.client.transaction("write");
    try {
      const transitioned = await tx.execute({
        sql: `UPDATE support_dispatch SET state = 'failed', lease_until = NULL, lease_token = NULL, last_error = ?, updated_at = ? WHERE id = ? AND case_id = ? AND state IN ('claimed', 'started')${leaseToken ? " AND lease_token = ? AND lease_until > ?" : ""}`,
        args: leaseToken
          ? [String(error), now(), id, caseId, leaseToken, now()]
          : [String(error), now(), id, caseId],
      });
      if (Number(transitioned.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      const caseRow = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [caseId],
      });
      const current = caseRow.rows[0]
        ? parse(caseRow.rows[0] as Record<string, unknown>)
        : undefined;
      await tx.execute({
        sql: "UPDATE support_turns SET state = ?, outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = (SELECT turn_id FROM support_dispatch WHERE id = ?) AND case_id = ?",
        args: [
          terminalStatus,
          JSON.stringify({
            status: terminalStatus,
            triage: current?.triage,
            policyMatches: current?.policyMatches,
            orderLookup: current?.orderLookup,
            subscriptionLookup: current?.subscriptionLookup,
            refundHistory: current?.refundHistory,
            draft: current?.draft,
            approval: current?.approval,
            refundResult: current?.refundResult,
            subscriptionCreditResult: current?.subscriptionCreditResult,
            finalResponse: current?.finalResponse,
            escalationReason: String(error),
            workflowRunId: current?.workflowRunId,
            ...(terminalStatus === "escalated"
              ? {
                  operationalFailure: {
                    disposition: "escalate",
                    recordedAt: now(),
                  },
                }
              : {}),
          }),
          now(),
          id,
          caseId,
        ],
      });
      if (caseRow.rows[0] && current) {
        const updated = withBindings({
          ...current,
          status: terminalStatus,
          escalationReason: String(error),
          metadata: { ...current.metadata, workflowStatus: terminalStatus },
          updatedAt: now(),
        });
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            caseId,
            Number(caseRow.rows[0].version ?? 1),
          ],
        });
        if (Number(write.rowsAffected) !== 1)
          throw new StaleCaseWriteError(caseId);
      }
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** A provider/tool fault has a bounded durable retry path. The claim counter
   * is incremented before work begins, so this may only restore attempts 1-2;
   * the third failed claim falls through to terminal human escalation. */
  async retryDispatch(
    id: string,
    caseId: string,
    error: unknown,
    leaseToken?: string,
  ) {
    const tx = await this.client.transaction("write");
    try {
      const retried = await tx.execute({
        sql: `UPDATE support_dispatch SET state = 'pending', lease_until = NULL, lease_token = NULL, last_error = ?, updated_at = ? WHERE id = ? AND case_id = ? AND state IN ('claimed', 'started') AND attempts < 3${leaseToken ? " AND lease_token = ?" : ""}`,
        args: leaseToken
          ? [String(error), now(), id, caseId, leaseToken]
          : [String(error), now(), id, caseId],
      });
      if (Number(retried.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      await tx.execute({
        sql: "UPDATE support_turns SET state = 'pending', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = (SELECT turn_id FROM support_dispatch WHERE id = ?) AND case_id = ?",
        args: [
          JSON.stringify({
            operationalFailure: { disposition: "retry", recordedAt: now() },
          }),
          now(),
          id,
          caseId,
        ],
      });
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async markDispatchStarted(dispatchId: string, leaseToken?: string) {
    await this.client.execute({
      sql: `UPDATE support_dispatch SET state = 'started', updated_at = ? WHERE id = ? AND state = 'claimed'${leaseToken ? " AND lease_token = ?" : ""}`,
      args: leaseToken ? [now(), dispatchId, leaseToken] : [now(), dispatchId],
    });
    await this.client.execute({
      sql: "UPDATE support_turns SET state = 'processing', updated_at = ? WHERE id = (SELECT turn_id FROM support_dispatch WHERE id = ?)",
      args: [now(), dispatchId],
    });
  }
  /** The turn claim, public active projection, and started state change as one
   * transaction. A queued turn can never inherit a prior turn's identity. */
  async activateDispatch(dispatch: DispatchRecord) {
    if (!dispatch.leaseToken) return false;
    const tx = await this.client.transaction("write");
    try {
      const started = await tx.execute({
        sql: "UPDATE support_dispatch SET state = 'started', updated_at = ? WHERE id = ? AND case_id = ? AND turn_id = ? AND state = 'claimed' AND lease_token = ?",
        args: [
          now(),
          dispatch.id,
          dispatch.caseId,
          dispatch.turnId,
          dispatch.leaseToken,
        ],
      });
      if (Number(started.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      const row = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [dispatch.caseId],
      });
      if (!row.rows[0])
        throw new Error(`Support case not found: ${dispatch.caseId}`);
      const current = parse(row.rows[0] as Record<string, unknown>);
      const previousTurnId = current.metadata.activeTurnId;
      const switchesTurn = previousTurnId !== dispatch.turnId;
      if (switchesTurn && typeof previousTurnId === "string")
        await tx.execute({
          sql: "UPDATE support_turns SET outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
          args: [
            JSON.stringify({
              status: current.status,
              triage: current.triage,
              policyMatches: current.policyMatches,
              orderLookup: current.orderLookup,
              subscriptionLookup: current.subscriptionLookup,
              refundHistory: current.refundHistory,
              draft: current.draft,
              approval: current.approval,
              refundResult: current.refundResult,
              subscriptionCreditResult: current.subscriptionCreditResult,
              finalResponse: current.finalResponse,
              escalationReason: current.escalationReason,
              workflowRunId: current.workflowRunId,
            }),
            now(),
            previousTurnId,
            dispatch.caseId,
          ],
        });
      const updated = withBindings({
        ...current,
        status: "processing",
        triage: switchesTurn ? undefined : current.triage,
        policyMatches: switchesTurn ? undefined : current.policyMatches,
        orderLookup: switchesTurn ? undefined : current.orderLookup,
        subscriptionLookup: switchesTurn
          ? undefined
          : current.subscriptionLookup,
        refundHistory: switchesTurn ? undefined : current.refundHistory,
        draft: switchesTurn ? undefined : current.draft,
        approval: switchesTurn ? undefined : current.approval,
        refundResult: switchesTurn ? undefined : current.refundResult,
        subscriptionCreditResult: switchesTurn
          ? undefined
          : current.subscriptionCreditResult,
        finalResponse: switchesTurn ? undefined : current.finalResponse,
        escalationReason: switchesTurn ? undefined : current.escalationReason,
        traceId: switchesTurn ? undefined : current.traceId,
        agentUsage: switchesTurn ? undefined : current.agentUsage,
        workflowRunId: dispatch.runId,
        metadata: {
          ...current.metadata,
          activeTurnId: dispatch.turnId,
          pendingTurnId: undefined,
          ...(switchesTurn
            ? {
                refundCommand: undefined,
                subscriptionCreditCommand: undefined,
                nativeApproval: undefined,
                refundEffects: undefined,
                subscriptionCreditEffects: undefined,
              }
            : {}),
        },
        updatedAt: now(),
      });
      const written = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [
          JSON.stringify(updated),
          updated.updatedAt,
          dispatch.caseId,
          Number(row.rows[0].version ?? 1),
        ],
      });
      if (Number(written.rowsAffected) !== 1)
        throw new StaleCaseWriteError(dispatch.caseId);
      await tx.execute({
        sql: "UPDATE support_turns SET state = 'processing', updated_at = ? WHERE id = ? AND case_id = ?",
        args: [now(), dispatch.turnId, dispatch.caseId],
      });
      await tx.commit();
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

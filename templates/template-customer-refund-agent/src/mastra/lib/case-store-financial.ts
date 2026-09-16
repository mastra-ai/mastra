import type { Client } from "@libsql/client";
import { moneyToLegacyAmount, structurallyEqual } from "./money";
import type { SupportCase } from "../domain/support-case";
import { bindingsForCase, type ProviderBinding } from "../providers/contracts";
import { activeDispatchLeaseScope } from "./dispatch-lease-scope";
import {
  now,
  parse,
  isFinancialRetentionTombstone,
  financialRetentionTombstoneError,
  withBindings,
  StaleCaseWriteError,
  outboxFingerprint,
  stripeAttempt,
} from "./case-store-shared";

export class CaseStoreFinancial {
  constructor(private readonly client: Client) {}
  async projectRefundToolExecution(input: {
    caseId: string;
    turnId: string;
    fingerprint: string;
    idempotencyKey: string;
    result: NonNullable<SupportCase["refundResult"]>;
    effect?: unknown;
  }): Promise<NonNullable<SupportCase["refundResult"]>> {
    const tx = await this.client.transaction("write");
    try {
      const caseResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = caseResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error(`Support case not found: ${input.caseId}`);
      const current = parse({ data: row.data });
      const metadata = current.metadata;
      const command = metadata.refundCommand;
      const native = metadata.nativeApproval;
      // Migrations give pre-turn records a durable legacy turn identity, but
      // those records have no activeTurnId projection marker. Accept only the
      // exact per-case legacy identity when the marker is absent; any actual
      // active turn, including a newer one, must still match this execution.
      const currentTurn =
        metadata.activeTurnId === input.turnId ||
        (metadata.activeTurnId === undefined &&
          input.turnId === `legacy:${input.caseId}`);
      if (
        !currentTurn ||
        command?.fingerprint !== input.fingerprint ||
        command.idempotencyKey !== input.idempotencyKey ||
        native?.fingerprint !== input.fingerprint ||
        native.turnId !== input.turnId
      )
        throw new Error(
          "Refund projection does not match the current immutable command and turn.",
        );
      const lease = activeDispatchLeaseScope();
      if (lease) {
        const owned = await tx.execute({
          sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
          args: [
            lease.dispatchId,
            input.caseId,
            input.turnId,
            lease.leaseToken,
            now(),
          ],
        });
        if (!owned.rows[0])
          throw new StaleCaseWriteError(
            `Dispatch lease is no longer current for ${input.caseId}.`,
          );
      }
      const ledgerResult = await tx.execute({
        sql: "SELECT case_id, turn_id, command_fingerprint, status FROM support_stripe_refund_attempts WHERE idempotency_key = ?",
        args: [input.idempotencyKey],
      });
      const ledger = ledgerResult.rows[0] as
        Record<string, unknown> | undefined;
      if (ledger) {
        if (
          String(ledger.case_id) !== input.caseId ||
          String(ledger.turn_id) !== input.turnId ||
          String(ledger.command_fingerprint) !== input.fingerprint
        )
          throw new Error(
            "Refund projection ledger does not match the immutable command and turn.",
          );
        if (["failed", "quarantined"].includes(String(ledger.status))) {
          const authoritative = current.refundResult;
          if (!authoritative || authoritative.status !== "failed")
            throw new Error(
              "Failed refund ledger is missing its authoritative case projection.",
            );
          await tx.commit();
          return authoritative;
        }
      }
      const updated = withBindings({
        ...current,
        refundResult: input.result,
        metadata: {
          ...metadata,
          refundEffects: {
            ...metadata.refundEffects,
            [input.fingerprint]: input.result,
          },
        },
        updatedAt: now(),
      } as SupportCase);
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [
          JSON.stringify(updated),
          updated.updatedAt,
          input.caseId,
          Number(row.version),
        ],
      });
      if (Number(write.rowsAffected ?? 0) !== 1)
        throw new StaleCaseWriteError(input.caseId);
      if (input.effect)
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
          args: [
            input.idempotencyKey,
            input.fingerprint,
            JSON.stringify(input.effect),
            now(),
          ],
        });
      await tx.commit();
      return input.result;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async projectSubscriptionCreditToolExecution(input: {
    caseId: string;
    turnId: string;
    fingerprint: string;
    idempotencyKey: string;
    result: NonNullable<SupportCase["subscriptionCreditResult"]>;
    effect: unknown;
  }): Promise<NonNullable<SupportCase["subscriptionCreditResult"]>> {
    const tx = await this.client.transaction("write");
    try {
      const found = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = found.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error(`Support case not found: ${input.caseId}`);
      const current = parse({ data: row.data });
      const command = current.metadata.subscriptionCreditCommand;
      const native = current.metadata.nativeApproval;
      if (
        current.metadata.activeTurnId !== input.turnId ||
        command?.fingerprint !== input.fingerprint ||
        command.idempotencyKey !== input.idempotencyKey ||
        native?.fingerprint !== input.fingerprint ||
        native.turnId !== input.turnId
      )
        throw new Error(
          "Subscription credit projection does not match the current immutable command and turn.",
        );
      const existing = await tx.execute({
        sql: "SELECT fingerprint, effect FROM support_idempotency WHERE idempotency_key = ?",
        args: [input.idempotencyKey],
      });
      if (
        existing.rows[0] &&
        String(existing.rows[0].fingerprint) !== input.fingerprint
      )
        throw new Error(
          "Subscription credit idempotency key conflicts with another command.",
        );
      const updated = withBindings({
        ...current,
        subscriptionCreditResult: input.result,
        metadata: {
          ...current.metadata,
          subscriptionCreditEffects: {
            ...current.metadata.subscriptionCreditEffects,
            [input.fingerprint]: input.result,
          },
        },
        updatedAt: now(),
      } as SupportCase);
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [
          JSON.stringify(updated),
          updated.updatedAt,
          input.caseId,
          Number(row.version),
        ],
      });
      if (Number(write.rowsAffected) !== 1)
        throw new StaleCaseWriteError(input.caseId);
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
        args: [
          input.idempotencyKey,
          input.fingerprint,
          JSON.stringify(input.effect),
          now(),
        ],
      });
      await tx.commit();
      return input.result;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async prepareStripeRefundAttempt(input: {
    caseId: string;
    binding: ProviderBinding;
    fingerprint: string;
    idempotencyKey: string;
    dispatchId: string;
    leaseToken: string;
    turnId: string;
    command: unknown;
  }) {
    const retained = await this.client.execute({
      sql: "SELECT effect FROM support_idempotency WHERE idempotency_key = ?",
      args: [input.idempotencyKey],
    });
    if (
      retained.rows[0] &&
      isFinancialRetentionTombstone(JSON.parse(String(retained.rows[0].effect)))
    )
      throw financialRetentionTombstoneError();
    const createdAt = now();
    await this.client.execute({
      sql: "INSERT OR IGNORE INTO support_stripe_refund_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)",
      args: [
        `stripe_attempt_${crypto.randomUUID()}`,
        input.caseId,
        input.binding.tenantId,
        input.binding.providerAccountId,
        input.fingerprint,
        input.idempotencyKey,
        input.dispatchId,
        input.leaseToken,
        input.turnId,
        JSON.stringify(input.command),
        createdAt,
        createdAt,
      ],
    });
    const row = await this.client.execute({
      sql: "SELECT * FROM support_stripe_refund_attempts WHERE idempotency_key = ?",
      args: [input.idempotencyKey],
    });
    const found = row.rows[0] as Record<string, unknown> | undefined;
    if (
      !found ||
      String(found.case_id) !== input.caseId ||
      String(found.tenant_id) !== input.binding.tenantId ||
      String(found.provider_account_id) !== input.binding.providerAccountId ||
      String(found.command_fingerprint) !== input.fingerprint ||
      String(found.turn_id) !== input.turnId ||
      !structurallyEqual(
        found.command_data ? JSON.parse(String(found.command_data)) : undefined,
        input.command,
      )
    )
      throw new Error(
        "Stripe idempotency key was reused with a conflicting command.",
      );
    return stripeAttempt(found);
  }
  async prepareStripeSubscriptionCreditAttempt(input: {
    caseId: string;
    binding: ProviderBinding;
    customerId: string;
    subscriptionId: string;
    fingerprint: string;
    idempotencyKey: string;
    dispatchId: string;
    leaseToken: string;
    turnId: string;
    command: unknown;
  }) {
    const tx = await this.client.transaction("write");
    try {
      const retained = await tx.execute({
        sql: "SELECT effect FROM support_idempotency WHERE idempotency_key = ?",
        args: [input.idempotencyKey],
      });
      if (
        retained.rows[0] &&
        isFinancialRetentionTombstone(
          JSON.parse(String(retained.rows[0].effect)),
        )
      )
        throw financialRetentionTombstoneError();
      const createdAt = now();
      const inserted = await tx.execute({
        sql: "INSERT OR IGNORE INTO support_stripe_subscription_credit_attempts(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)",
        args: [
          `stripe_credit_attempt_${crypto.randomUUID()}`,
          input.caseId,
          input.binding.tenantId,
          input.binding.providerAccountId,
          input.fingerprint,
          input.idempotencyKey,
          input.dispatchId,
          input.leaseToken,
          input.turnId,
          JSON.stringify(input.command),
          createdAt,
          createdAt,
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_stripe_subscription_credit_reservations(tenant_id, provider_account_id, customer_id, subscription_id, case_id, turn_id, command_fingerprint, idempotency_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)",
        args: [
          input.binding.tenantId,
          input.binding.providerAccountId,
          input.customerId,
          input.subscriptionId,
          input.caseId,
          input.turnId,
          input.fingerprint,
          input.idempotencyKey,
          createdAt,
          createdAt,
        ],
      });
      const reservation = await tx.execute({
        sql: "SELECT case_id, turn_id, command_fingerprint, idempotency_key FROM support_stripe_subscription_credit_reservations WHERE tenant_id = ? AND provider_account_id = ? AND customer_id = ? AND subscription_id = ?",
        args: [
          input.binding.tenantId,
          input.binding.providerAccountId,
          input.customerId,
          input.subscriptionId,
        ],
      });
      const held = reservation.rows[0] as Record<string, unknown> | undefined;
      if (
        !held ||
        String(held.case_id) !== input.caseId ||
        String(held.turn_id) !== input.turnId ||
        String(held.command_fingerprint) !== input.fingerprint ||
        String(held.idempotency_key) !== input.idempotencyKey
      )
        throw new Error(
          "A prior subscription credit is already reserved for this customer and subscription and requires specialist review.",
        );
      const result = await tx.execute({
        sql: "SELECT * FROM support_stripe_subscription_credit_attempts WHERE idempotency_key = ?",
        args: [input.idempotencyKey],
      });
      const found = result.rows[0] as Record<string, unknown> | undefined;
      if (
        !found ||
        String(found.case_id) !== input.caseId ||
        String(found.tenant_id) !== input.binding.tenantId ||
        String(found.provider_account_id) !== input.binding.providerAccountId ||
        String(found.command_fingerprint) !== input.fingerprint ||
        String(found.turn_id) !== input.turnId ||
        !structurallyEqual(
          found.command_data
            ? JSON.parse(String(found.command_data))
            : undefined,
          input.command,
        )
      )
        throw new Error(
          "Stripe idempotency key was reused with a conflicting subscription credit command.",
        );
      await tx.commit();
      return {
        ...this.parseStripeSubscriptionCreditAttempt(found),
        inserted: Number(inserted.rowsAffected ?? 0) === 1,
      };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async updateStripeSubscriptionCreditAttempt(
    idempotencyKey: string,
    update: {
      status: "succeeded" | "unknown" | "failed" | "quarantined";
      creditId?: string;
      providerStatus?: string;
    },
  ) {
    const terminal = ["succeeded", "failed", "quarantined"].includes(
      update.status,
    );
    const write = await this.client.execute({
      sql: "UPDATE support_stripe_subscription_credit_attempts SET status = ?, credit_id = COALESCE(?, credit_id), provider_status = CASE WHEN provider_status = 'prepost-no-effect' AND ? <> 'succeeded' THEN provider_status ELSE COALESCE(?, provider_status) END, terminal_at = CASE WHEN ? THEN COALESCE(terminal_at, ?) ELSE terminal_at END, updated_at = ? WHERE idempotency_key = ? AND (status NOT IN ('succeeded','failed','quarantined') OR status = ?)",
      args: [
        update.status,
        update.creditId ?? null,
        update.status,
        update.providerStatus ?? null,
        terminal ? 1 : 0,
        now(),
        now(),
        idempotencyKey,
        update.status,
      ],
    });
    if (Number(write.rowsAffected ?? 0) !== 1) return false;
    await this.client.execute({
      sql: "UPDATE support_stripe_subscription_credit_reservations SET status = ?, updated_at = ? WHERE idempotency_key = ?",
      args: [update.status, now(), idempotencyKey],
    });
    return true;
  }
  /** A definite Stripe refusal proves no balance credit was created. Close the
   * immutable command once, record the staff-review outcome, and keep its
   * reservation so a second case cannot turn this into fresh compensation. */
  async finalizeStripeSubscriptionCreditNoEffectFailure(input: {
    idempotencyKey: string;
    fingerprint: string;
    dispatch: { dispatchId: string; leaseToken: string; turnId: string };
  }) {
    const tx = await this.client.transaction("write");
    try {
      const found = await tx.execute({
        sql: "SELECT * FROM support_stripe_subscription_credit_attempts WHERE idempotency_key = ? AND command_fingerprint = ?",
        args: [input.idempotencyKey, input.fingerprint],
      });
      const attempt = found.rows[0] as Record<string, unknown> | undefined;
      if (
        !attempt ||
        !["prepared", "unknown"].includes(String(attempt.status))
      ) {
        await tx.rollback();
        return false;
      }
      const preparedWorker =
        String(attempt.dispatch_id) === input.dispatch.dispatchId &&
        String(attempt.lease_token) === input.dispatch.leaseToken &&
        String(attempt.turn_id) === input.dispatch.turnId;
      const currentWorker = await tx.execute({
        sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
        args: [
          input.dispatch.dispatchId,
          String(attempt.case_id),
          input.dispatch.turnId,
          input.dispatch.leaseToken,
          now(),
        ],
      });
      if (!preparedWorker && !currentWorker.rows[0]) {
        await tx.rollback();
        return false;
      }
      // A stale worker may observe a preflight refusal after another worker
      // has reclaimed this suspended dispatch. That newer lease owns the
      // prepared reservation and its recovery outcome, so the stale worker
      // must not close the immutable command underneath it.
      const newerLease = await tx.execute({
        sql: "SELECT id, lease_token FROM support_dispatch WHERE case_id = ? AND state IN ('claimed', 'started') AND lease_until > ? AND (id <> ? OR lease_token <> ?)",
        args: [
          String(attempt.case_id),
          now(),
          input.dispatch.dispatchId,
          input.dispatch.leaseToken,
        ],
      });
      if (newerLease.rows[0]) {
        await tx.rollback();
        return false;
      }
      const closed = await tx.execute({
        sql: "UPDATE support_stripe_subscription_credit_attempts SET status = 'failed', provider_status = 'confirmed-no-effect', terminal_at = COALESCE(terminal_at, ?), updated_at = ? WHERE idempotency_key = ? AND command_fingerprint = ? AND status IN ('prepared','unknown')",
        args: [now(), now(), input.idempotencyKey, input.fingerprint],
      });
      if (Number(closed.rowsAffected ?? 0) !== 1) {
        await tx.rollback();
        return false;
      }
      await tx.execute({
        sql: "UPDATE support_stripe_subscription_credit_reservations SET status = 'failed', updated_at = ? WHERE idempotency_key = ? AND command_fingerprint = ?",
        args: [now(), input.idempotencyKey, input.fingerprint],
      });
      await tx.execute({
        sql: "DELETE FROM support_idempotency WHERE idempotency_key = ? AND fingerprint = ?",
        args: [input.idempotencyKey, input.fingerprint],
      });
      const caseResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [String(attempt.case_id)],
      });
      const row = caseResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await tx.commit();
        return false;
      }
      const current = parse({ data: row.data });
      const turnId = String(attempt.turn_id);
      const response =
        "The subscription credit requires additional review. A support specialist will follow up shortly.";
      await tx.execute({
        sql: "UPDATE support_turns SET state = 'escalated', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
        args: [
          JSON.stringify({ status: "escalated", finalResponse: response }),
          now(),
          turnId,
          current.id,
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, 'subscription-credit-failure', ?, ?, ?)",
        args: [
          `action_${current.id}_${turnId}_subscription-credit-no-effect`,
          current.id,
          input.fingerprint,
          JSON.stringify({
            category: "provider",
            classification: "confirmed-no-effect",
            observedAt: now(),
          }),
          now(),
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'escalated', 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
        args: [
          `outbox_${current.id}_${turnId}_subscription-credit-no-effect`,
          current.id,
          JSON.stringify(bindingsForCase(current).support),
          response,
          outboxFingerprint(
            bindingsForCase(current).support,
            "reply",
            response,
            "escalated",
          ),
          turnId,
          now(),
          now(),
        ],
      });
      if (current.metadata.activeTurnId === turnId) {
        const updated = withBindings({
          ...current,
          status: "escalated" as const,
          escalationReason:
            "The subscription credit could not be completed and requires staff review.",
          finalResponse: response,
          updatedAt: now(),
        });
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            current.id,
            Number(row.version),
          ],
        });
        if (Number(write.rowsAffected ?? 0) !== 1)
          throw new StaleCaseWriteError(current.id);
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
  /** A worker that has not crossed the POST marker may prove the exact
   * prepared command has no remote effect even after losing its dispatch
   * lease. Retain that proof for the reclaiming worker; it owns the eventual
   * public terminalization and must never retry a non-existent receipt. */
  async markStripeSubscriptionCreditPrePostNoEffect(input: {
    idempotencyKey: string;
    fingerprint: string;
    dispatch: { dispatchId: string; leaseToken: string; turnId: string };
  }) {
    const write = await this.client.execute({
      sql: "UPDATE support_stripe_subscription_credit_attempts SET provider_status = 'prepost-no-effect', updated_at = ? WHERE idempotency_key = ? AND command_fingerprint = ? AND dispatch_id = ? AND lease_token = ? AND turn_id = ? AND status IN ('prepared', 'unknown')",
      args: [
        now(),
        input.idempotencyKey,
        input.fingerprint,
        input.dispatch.dispatchId,
        input.dispatch.leaseToken,
        input.dispatch.turnId,
      ],
    });
    return Number(write.rowsAffected ?? 0) === 1;
  }
  async stripeSubscriptionCreditAttempt(idempotencyKey: string) {
    const result = await this.client.execute({
      sql: "SELECT * FROM support_stripe_subscription_credit_attempts WHERE idempotency_key = ?",
      args: [idempotencyKey],
    });
    return result.rows[0]
      ? this.parseStripeSubscriptionCreditAttempt(
          result.rows[0] as Record<string, unknown>,
        )
      : undefined;
  }
  private parseStripeSubscriptionCreditAttempt(row: Record<string, unknown>) {
    return {
      id: String(row.id),
      caseId: String(row.case_id),
      tenantId: String(row.tenant_id),
      providerAccountId: String(row.provider_account_id),
      fingerprint: String(row.command_fingerprint),
      idempotencyKey: String(row.idempotency_key),
      dispatchId: String(row.dispatch_id),
      leaseToken: String(row.lease_token),
      turnId: String(row.turn_id),
      status: String(row.status) as
        "prepared" | "succeeded" | "unknown" | "failed" | "quarantined",
      creditId: row.credit_id ? String(row.credit_id) : undefined,
      providerStatus: row.provider_status
        ? String(row.provider_status)
        : undefined,
      command: JSON.parse(String(row.command_data)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      terminalAt: row.terminal_at ? String(row.terminal_at) : undefined,
    };
  }
  async updateStripeRefundAttempt(
    idempotencyKey: string,
    update: {
      status: "pending" | "succeeded" | "failed" | "unknown" | "quarantined";
      refundId?: string;
      providerStatus?: string;
      nextAttemptAt?: string;
    },
  ) {
    const terminal = ["succeeded", "failed", "quarantined"].includes(
      update.status,
    );
    const write = await this.client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET status = ?, refund_id = COALESCE(?, refund_id), provider_status = COALESCE(?, provider_status), next_attempt_at = ?, reconcile_lease_token = NULL, reconcile_lease_until = NULL, terminal_at = CASE WHEN ? THEN COALESCE(terminal_at, ?) ELSE terminal_at END, updated_at = ? WHERE idempotency_key = ? AND (status NOT IN ('succeeded', 'failed', 'quarantined') OR status = ?)",
      args: [
        update.status,
        update.refundId ?? null,
        update.providerStatus ?? null,
        update.nextAttemptAt ?? null,
        terminal ? 1 : 0,
        now(),
        now(),
        idempotencyKey,
        update.status,
      ],
    });
    return Number(write.rowsAffected ?? 0) === 1;
  }
  async persistStripeRefundRequest(
    idempotencyKey: string,
    request: { paymentIntentId: string; providerRefs: unknown[] },
  ) {
    const write = await this.client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET stripe_request_data = ?, updated_at = ? WHERE idempotency_key = ? AND status = 'prepared' AND stripe_request_data IS NULL",
      args: [JSON.stringify(request), now(), idempotencyKey],
    });
    if (Number(write.rowsAffected ?? 0) !== 1) {
      const found = await this.stripeRefundAttempt(idempotencyKey);
      if (
        !found?.stripeRequest ||
        !structurallyEqual(found.stripeRequest, request)
      )
        throw new Error("Stripe refund request target was already changed.");
    }
    return this.stripeRefundAttempt(idempotencyKey);
  }
  /** Release only the lease owned by this reconciliation worker while
   * scheduling its retry. A stale worker cannot clobber a newer claim. */
  async rescheduleStripeRefundAttempt(input: {
    idempotencyKey: string;
    reconcileLeaseToken: string;
    status: "pending" | "succeeded" | "unknown" | "quarantined";
    refundId?: string;
    providerStatus?: string;
    nextAttemptAt?: string;
  }) {
    const write = await this.client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET status = ?, refund_id = COALESCE(?, refund_id), provider_status = COALESCE(?, provider_status), next_attempt_at = ?, reconcile_lease_token = NULL, reconcile_lease_until = NULL, terminal_at = CASE WHEN ? THEN COALESCE(terminal_at, ?) ELSE terminal_at END, reconcile_attempts = reconcile_attempts + 1, updated_at = ? WHERE idempotency_key = ? AND reconcile_lease_token = ? AND reconcile_lease_until > ? AND status NOT IN ('succeeded', 'failed', 'quarantined')",
      args: [
        input.status,
        input.refundId ?? null,
        input.providerStatus ?? null,
        input.nextAttemptAt ?? null,
        input.status === "quarantined" ? 1 : 0,
        now(),
        now(),
        input.idempotencyKey,
        input.reconcileLeaseToken,
        now(),
      ],
    });
    return Number(write.rowsAffected ?? 0) === 1;
  }
  /** Commit terminal provider state, the case projection, and its one customer
   * notification together. A crash cannot leave a succeeded attempt with no
   * final outbox item, and a later follow-up cannot be overwritten because the
   * attempt's immutable originating turn owns the projection. */
  async finalizeStripeRefundReconciliation(input: {
    idempotencyKey: string;
    status: "succeeded" | "failed" | "pending" | "quarantined";
    refundId: string;
    providerStatus: string;
    effect?: unknown;
    reconcileLeaseToken?: string;
  }) {
    const tx = await this.client.transaction("write");
    try {
      const attemptResult = await tx.execute({
        sql: "SELECT * FROM support_stripe_refund_attempts WHERE idempotency_key = ?",
        args: [input.idempotencyKey],
      });
      const attempt = attemptResult.rows[0] as
        Record<string, unknown> | undefined;
      if (!attempt) {
        await tx.rollback();
        return false;
      }
      const previousStatus = String(attempt.status);
      const leaseOwned =
        !input.reconcileLeaseToken ||
        (String(attempt.reconcile_lease_token ?? "") ===
          input.reconcileLeaseToken &&
          Date.parse(String(attempt.reconcile_lease_until ?? "")) > Date.now());
      const transitionAllowed =
        leaseOwned &&
        !(
          input.status === "succeeded" &&
          ["failed", "quarantined"].includes(previousStatus)
        ) &&
        !(
          input.status === "pending" &&
          ["succeeded", "failed", "quarantined"].includes(previousStatus)
        ) &&
        !(
          input.status === "quarantined" &&
          ["succeeded", "failed", "quarantined"].includes(previousStatus)
        );
      if (!transitionAllowed) {
        await tx.rollback();
        return false;
      }
      const terminal = ["succeeded", "failed", "quarantined"].includes(
        input.status,
      );
      const updateArgs: (string | number | null)[] = [
        input.status,
        input.refundId,
        input.providerStatus,
        input.status === "pending"
          ? new Date(Date.now() + 30_000).toISOString()
          : input.status === "succeeded"
            ? new Date(Date.now() + 5 * 60_000).toISOString()
            : null,
        terminal ? 1 : 0,
        now(),
        now(),
        input.idempotencyKey,
      ];
      let updateSql =
        "UPDATE support_stripe_refund_attempts SET status = ?, refund_id = ?, provider_status = ?, next_attempt_at = ?, reconcile_lease_token = NULL, reconcile_lease_until = NULL, terminal_at = CASE WHEN ? THEN COALESCE(terminal_at, ?) ELSE terminal_at END, reconcile_attempts = reconcile_attempts + 1, updated_at = ? WHERE idempotency_key = ? AND (status NOT IN ('succeeded', 'failed', 'quarantined') OR (status = 'succeeded' AND ? = 'failed') OR (status = 'failed' AND ? = 'failed'))";
      updateArgs.push(input.status);
      updateArgs.push(input.status);
      if (input.reconcileLeaseToken) {
        updateSql +=
          " AND reconcile_lease_token = ? AND reconcile_lease_until > ?";
        updateArgs.push(input.reconcileLeaseToken, now());
      }
      const attemptWrite = await tx.execute({
        sql: updateSql,
        args: updateArgs,
      });
      if (Number(attemptWrite.rowsAffected ?? 0) !== 1) {
        await tx.rollback();
        return false;
      }
      if (input.status === "pending") {
        await tx.commit();
        return false;
      }
      // A later authoritative failure supersedes a previously persisted
      // success effect in this same ledger/case transaction. Readers also
      // consult the attempt ledger, but deleting the stale effect prevents a
      // process restart from treating historical success bytes as executable.
      if (input.status === "failed")
        await tx.execute({
          sql: "DELETE FROM support_idempotency WHERE idempotency_key = ? AND fingerprint = ?",
          args: [input.idempotencyKey, String(attempt.command_fingerprint)],
        });
      const caseResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [String(attempt.case_id)],
      });
      const row = caseResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await tx.commit();
        return false;
      }
      const current = parse({ data: row.data });
      const turnId = attempt.turn_id ? String(attempt.turn_id) : undefined;
      const activeTurnId = current.metadata.activeTurnId;
      // Keep the provider audit authoritative, but never change a current case
      // projection that belongs to a newer customer turn.
      if (!turnId) {
        await tx.commit();
        return false;
      }
      // A follow-up owns the current case projection, but it cannot erase the
      // financial outcome of this attempt's immutable originating turn.
      if (activeTurnId !== turnId) {
        const response =
          input.status === "succeeded"
            ? "Your refund has been issued."
            : "The refund requires additional review. A support specialist will follow up shortly.";
        const terminal =
          input.status === "succeeded" ? "resolved" : "escalated";
        await tx.execute({
          sql: "UPDATE support_turns SET state = ?, outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
          args: [
            terminal,
            JSON.stringify({
              status: terminal,
              finalResponse: response,
              refundId: input.refundId,
            }),
            now(),
            turnId,
            current.id,
          ],
        });
        if (input.status === "succeeded")
          await tx.execute({
            sql: "INSERT OR IGNORE INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
            args: [
              input.idempotencyKey,
              String(attempt.command_fingerprint),
              JSON.stringify(input.effect ?? {}),
              now(),
            ],
          });
        else
          await tx.execute({
            sql: "INSERT OR IGNORE INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, 'refund-failure', ?, ?, ?)",
            args: [
              `action_${current.id}_${turnId}_refund-failure`,
              current.id,
              String(attempt.command_fingerprint),
              JSON.stringify({
                category: "provider",
                classification: "confirmed-failed",
                refundId: input.refundId,
              }),
              now(),
            ],
          });
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
          args: [
            `outbox_${current.id}_${turnId}_${input.status === "succeeded" ? "refund-final" : "refund-failed"}`,
            current.id,
            JSON.stringify(bindingsForCase(current).support),
            response,
            terminal,
            outboxFingerprint(
              bindingsForCase(current).support,
              "reply",
              response,
              terminal,
            ),
            turnId,
            now(),
            now(),
          ],
        });
        await tx.commit();
        return true;
      }
      if (input.status === "succeeded") {
        const currentRefund = current.refundResult;
        if (currentRefund?.status === "failed") {
          await tx.commit();
          return false;
        }
        const command = attempt.command_data
          ? (JSON.parse(String(attempt.command_data)) as {
              amount?: { currency?: string; minor?: number };
              orderId?: string;
            })
          : undefined;
        const derivedRefund =
          currentRefund ??
          (typeof command?.amount?.currency === "string" &&
          typeof command.amount.minor === "number"
            ? {
                refundId: input.refundId,
                orderId: command.orderId ?? "unknown",
                amount: moneyToLegacyAmount({
                  currency: command.amount.currency,
                  minor: command.amount.minor,
                }),
                currency: command.amount.currency,
                status: "pending" as const,
                idempotencyKey: input.idempotencyKey,
                executedAt: now(),
              }
            : undefined);
        if (!derivedRefund) {
          await tx.commit();
          return false;
        }
        const result = { ...derivedRefund, status: "executed" as const };
        const response = `Your refund of ${result.amount} ${result.currency} has been issued.`;
        const updated = {
          ...current,
          status: "resolved" as const,
          refundResult: result,
          finalResponse: response,
          updatedAt: now(),
        };
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            current.id,
            Number(row.version),
          ],
        });
        await tx.execute({
          sql: "UPDATE support_turns SET state = 'resolved', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
          args: [
            JSON.stringify({
              status: "resolved",
              finalResponse: response,
              refundId: input.refundId,
            }),
            now(),
            turnId,
            current.id,
          ],
        });
        if (Number(write.rowsAffected ?? 0) !== 1)
          throw new StaleCaseWriteError(current.id);
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
          args: [
            input.idempotencyKey,
            String(attempt.command_fingerprint),
            JSON.stringify(input.effect ?? {}),
            now(),
          ],
        });
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'resolved', 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
          args: [
            `outbox_${current.id}_${turnId}_refund-final`,
            current.id,
            JSON.stringify(bindingsForCase(current).support),
            response,
            outboxFingerprint(
              bindingsForCase(current).support,
              "reply",
              response,
              "resolved",
            ),
            turnId,
            now(),
            now(),
          ],
        });
      } else {
        const correction =
          "The refund requires additional review. A support specialist will follow up shortly.";
        const command = attempt.command_data
          ? (JSON.parse(String(attempt.command_data)) as {
              amount?: { currency?: string; minor?: number };
              orderId?: string;
            })
          : undefined;
        const derivedRefund =
          current.refundResult ??
          (typeof command?.amount?.currency === "string" &&
          typeof command.amount.minor === "number"
            ? {
                refundId: input.refundId,
                orderId: command.orderId ?? "unknown",
                amount: moneyToLegacyAmount({
                  currency: command.amount.currency,
                  minor: command.amount.minor,
                }),
                currency: command.amount.currency,
                status: "pending" as const,
                idempotencyKey: input.idempotencyKey,
                executedAt: now(),
              }
            : undefined);
        const updated = {
          ...current,
          status: "escalated" as const,
          escalationReason:
            "Stripe reported that the approved refund failed and requires staff review.",
          refundResult: derivedRefund
            ? { ...derivedRefund, status: "failed" as const }
            : undefined,
          finalResponse: correction,
          updatedAt: now(),
        };
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            current.id,
            Number(row.version),
          ],
        });
        await tx.execute({
          sql: "UPDATE support_turns SET state = 'escalated', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
          args: [
            JSON.stringify({
              status: "escalated",
              finalResponse: correction,
              refundId: input.refundId,
            }),
            now(),
            turnId,
            current.id,
          ],
        });
        if (Number(write.rowsAffected ?? 0) !== 1)
          throw new StaleCaseWriteError(current.id);
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, 'refund-failure', ?, ?, ?)",
          args: [
            `action_${current.id}_${turnId}_refund-failure`,
            current.id,
            String(attempt.command_fingerprint),
            JSON.stringify({
              category: "provider",
              classification: "confirmed-failed",
              refundId: input.refundId,
              observedAt: now(),
            }),
            now(),
          ],
        });
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'escalated', 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
          args: [
            `outbox_${current.id}_${turnId}_refund-failed`,
            current.id,
            JSON.stringify(bindingsForCase(current).support),
            correction,
            outboxFingerprint(
              bindingsForCase(current).support,
              "reply",
              correction,
              "escalated",
            ),
            turnId,
            now(),
            now(),
          ],
        });
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
  /** A preflight denial or a non-ambiguous Stripe POST rejection proves no
   * financial effect. Close its durable attempt, originating turn, audit and
   * one staff-review outbox item together; it must never enter GET recovery. */
  async finalizeStripeRefundNoEffectFailure(input: {
    idempotencyKey: string;
    fingerprint: string;
    diagnostic?: {
      stage: "preflight" | "post";
      status?: number;
      ambiguity?: boolean;
      code?: string;
      type?: string;
      requestId?: string;
    };
  }) {
    const tx = await this.client.transaction("write");
    try {
      const found = await tx.execute({
        sql: "SELECT * FROM support_stripe_refund_attempts WHERE idempotency_key = ? AND command_fingerprint = ?",
        args: [input.idempotencyKey, input.fingerprint],
      });
      const attempt = found.rows[0] as Record<string, unknown> | undefined;
      if (
        !attempt ||
        !["prepared", "unknown"].includes(String(attempt.status))
      ) {
        await tx.rollback();
        return false;
      }
      const closed = await tx.execute({
        sql: "UPDATE support_stripe_refund_attempts SET status = 'failed', provider_status = 'confirmed-no-effect', next_attempt_at = NULL, reconcile_lease_token = NULL, reconcile_lease_until = NULL, terminal_at = COALESCE(terminal_at, ?), updated_at = ? WHERE idempotency_key = ? AND command_fingerprint = ? AND status IN ('prepared', 'unknown')",
        args: [now(), now(), input.idempotencyKey, input.fingerprint],
      });
      if (Number(closed.rowsAffected ?? 0) !== 1) {
        await tx.rollback();
        return false;
      }
      await tx.execute({
        sql: "DELETE FROM support_idempotency WHERE idempotency_key = ? AND fingerprint = ?",
        args: [input.idempotencyKey, input.fingerprint],
      });
      const caseResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [String(attempt.case_id)],
      });
      const row = caseResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        await tx.commit();
        return false;
      }
      const current = parse({ data: row.data });
      const turnId = String(attempt.turn_id);
      const response =
        "The refund requires additional review. A support specialist will follow up shortly.";
      await tx.execute({
        sql: "UPDATE support_turns SET state = 'escalated', outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
        args: [
          JSON.stringify({ status: "escalated", finalResponse: response }),
          now(),
          turnId,
          current.id,
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, 'refund-failure', ?, ?, ?)",
        args: [
          `action_${current.id}_${turnId}_refund-no-effect`,
          current.id,
          input.fingerprint,
          JSON.stringify({
            category: "provider",
            classification: "confirmed-no-effect",
            ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}),
          }),
          now(),
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'escalated', 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
        args: [
          `outbox_${current.id}_${turnId}_refund-no-effect`,
          current.id,
          JSON.stringify(bindingsForCase(current).support),
          response,
          outboxFingerprint(
            bindingsForCase(current).support,
            "reply",
            response,
            "escalated",
          ),
          turnId,
          now(),
          now(),
        ],
      });
      if (current.metadata.activeTurnId === turnId) {
        const updated = {
          ...current,
          status: "escalated" as const,
          escalationReason:
            "The refund could not be completed and requires staff review.",
          finalResponse: response,
          updatedAt: now(),
        };
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            current.id,
            Number(row.version),
          ],
        });
        if (Number(write.rowsAffected ?? 0) !== 1)
          throw new StaleCaseWriteError(current.id);
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
  async stripeRefundAttempt(idempotencyKey: string) {
    const row = await this.client.execute({
      sql: "SELECT * FROM support_stripe_refund_attempts WHERE idempotency_key = ?",
      args: [idempotencyKey],
    });
    return row.rows[0]
      ? stripeAttempt(row.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async stripeRefundAttemptByRefundId(refundId: string) {
    const row = await this.client.execute({
      sql: "SELECT * FROM support_stripe_refund_attempts WHERE refund_id = ?",
      args: [refundId],
    });
    return row.rows[0]
      ? stripeAttempt(row.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async claimableStripeRefundAttempts(limit = 10) {
    const claimedAt = now();
    const leaseUntil = new Date(Date.now() + 30_000).toISOString();
    const rows = await this.client.execute({
      // A prepared attempt belongs to the approval dispatch until its lease
      // expires.  Reconciliation may inspect it afterwards, but must not turn
      // it into `unknown` between preflight and persistence of the request.
      sql: "SELECT * FROM support_stripe_refund_attempts WHERE status IN ('pending', 'unknown', 'prepared', 'succeeded') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) AND (reconcile_lease_until IS NULL OR reconcile_lease_until < ?) AND NOT EXISTS (SELECT 1 FROM support_dispatch d WHERE d.id = support_stripe_refund_attempts.dispatch_id AND d.case_id = support_stripe_refund_attempts.case_id AND d.turn_id = support_stripe_refund_attempts.turn_id AND d.state IN ('claimed', 'started') AND d.lease_until > ?) ORDER BY updated_at LIMIT ?",
      args: [claimedAt, claimedAt, claimedAt, limit],
    });
    const claimed = [];
    for (const row of rows.rows) {
      const token = crypto.randomUUID();
      const write = await this.client.execute({
        // Repeat the dispatch predicate in the CAS.  The candidate query is
        // only an optimization; a dispatch can become active after it reads.
        sql: "UPDATE support_stripe_refund_attempts SET reconcile_lease_token = ?, reconcile_lease_until = ? WHERE id = ? AND status IN ('pending', 'unknown', 'prepared', 'succeeded') AND (reconcile_lease_until IS NULL OR reconcile_lease_until < ?) AND (next_attempt_at IS NULL OR next_attempt_at <= ?) AND NOT EXISTS (SELECT 1 FROM support_dispatch d WHERE d.id = support_stripe_refund_attempts.dispatch_id AND d.case_id = support_stripe_refund_attempts.case_id AND d.turn_id = support_stripe_refund_attempts.turn_id AND d.state IN ('claimed', 'started') AND d.lease_until > ?)",
        args: [
          token,
          leaseUntil,
          String(row.id),
          claimedAt,
          claimedAt,
          claimedAt,
        ],
      });
      if (Number(write.rowsAffected ?? 0) === 1) {
        const claimedRow = await this.client.execute({
          sql: "SELECT * FROM support_stripe_refund_attempts WHERE id = ? AND reconcile_lease_token = ?",
          args: [String(row.id), token],
        });
        if (claimedRow.rows[0])
          claimed.push({
            ...stripeAttempt(claimedRow.rows[0] as Record<string, unknown>),
            reconcileLeaseToken: token,
          });
      }
    }
    return claimed;
  }
  private stripeAttempt(row: Record<string, unknown>) {
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
  /** Enforce DEC-015 without deleting the durable replay keys or the financial
   * audit window.  Expired case rows become minimal tombstones so pending
   * references remain valid while customer content and trace references do not. */
}

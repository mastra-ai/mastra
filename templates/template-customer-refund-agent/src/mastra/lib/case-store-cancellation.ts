import type { Client } from "@libsql/client";
import { structurallyEqual } from "./money";
import { bindingsForCase, type ProviderBinding } from "../providers/contracts";
import {
  now,
  parse,
  isFinancialRetentionTombstone,
  financialRetentionTombstoneError,
  StaleCaseWriteError,
  outboxFingerprint,
} from "./case-store-shared";

export class CaseStoreCancellation {
  constructor(private readonly client: Client) {}
  async recordEffect(key: string, fingerprint: string, effect: unknown) {
    await this.client.execute({
      sql: "INSERT INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
      args: [key, fingerprint, JSON.stringify(effect), now()],
    });
  }
  async prepareSubscriptionCancellationAttempt(input: {
    caseId: string;
    turnId: string;
    binding: ProviderBinding;
    subscriptionId: string;
    idempotencyKey: string;
    fingerprint: string;
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
    const command = input.command as Partial<{
      caseId: string;
      turnId: string;
      binding: ProviderBinding;
      subscriptionId: string;
      idempotencyKey: string;
      fingerprint: string;
    }>;
    if (
      command.caseId !== input.caseId ||
      command.turnId !== input.turnId ||
      command.subscriptionId !== input.subscriptionId ||
      command.idempotencyKey !== input.idempotencyKey ||
      command.fingerprint !== input.fingerprint ||
      !structurallyEqual(command.binding, input.binding)
    )
      throw new Error(
        "Cancellation attempt does not match its immutable command.",
      );
    const timestamp = now();
    await this.client.execute({
      sql: "INSERT OR IGNORE INTO support_subscription_cancellation_attempts(idempotency_key, case_id, turn_id, tenant_id, provider_account_id, subscription_id, fingerprint, command_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)",
      args: [
        input.idempotencyKey,
        input.caseId,
        input.turnId,
        input.binding.tenantId,
        input.binding.providerAccountId,
        input.subscriptionId,
        input.fingerprint,
        JSON.stringify(input.command),
        timestamp,
        timestamp,
      ],
    });
    const result = await this.client.execute({
      sql: "SELECT * FROM support_subscription_cancellation_attempts WHERE idempotency_key = ?",
      args: [input.idempotencyKey],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (
      !row ||
      String(row.case_id) !== input.caseId ||
      String(row.turn_id) !== input.turnId ||
      String(row.fingerprint) !== input.fingerprint ||
      !structurallyEqual(JSON.parse(String(row.command_data)), input.command)
    )
      throw new Error(
        "Cancellation idempotency key was reused with another command.",
      );
    return {
      status: String(row.status),
      cancelsAt: row.cancels_at ? String(row.cancels_at) : undefined,
    };
  }
  /** Marks the hand-off immediately before a provider POST. A process crash
   * after this point is always recovered by GET; it can never issue a second
   * mutation from a durable prepared command. */
  async claimSubscriptionCancellationMutation(input: {
    idempotencyKey: string;
    fingerprint: string;
  }) {
    const claimed = await this.client.execute({
      sql: "UPDATE support_subscription_cancellation_attempts SET status = 'claimed', updated_at = ? WHERE idempotency_key = ? AND fingerprint = ? AND status = 'prepared'",
      args: [now(), input.idempotencyKey, input.fingerprint],
    });
    return Number(claimed.rowsAffected ?? 0) === 1;
  }
  async finalizeSubscriptionCancellationAttempt(input: {
    idempotencyKey: string;
    fingerprint: string;
    status: "scheduled" | "unknown" | "failed";
    cancelsAt?: string;
    effect?: unknown;
  }) {
    const terminal = input.status === "scheduled" || input.status === "failed";
    const tx = await this.client.transaction("write");
    try {
      const write = await tx.execute({
        sql: "UPDATE support_subscription_cancellation_attempts SET status = ?, cancels_at = COALESCE(?, cancels_at), terminal_at = CASE WHEN ? THEN COALESCE(terminal_at, ?) ELSE terminal_at END, next_reconcile_at = CASE WHEN ? = 'unknown' THEN ? ELSE NULL END, reconcile_lease_token = NULL, reconcile_lease_until = NULL, updated_at = ? WHERE idempotency_key = ? AND fingerprint = ? AND (status = 'claimed' OR status = ?)",
        args: [
          input.status,
          input.cancelsAt ?? null,
          terminal ? 1 : 0,
          terminal ? now() : null,
          input.status,
          input.status === "unknown" ? now() : null,
          now(),
          input.idempotencyKey,
          input.fingerprint,
          input.status,
        ],
      });
      if (Number(write.rowsAffected ?? 0) !== 1) {
        await tx.rollback();
        return false;
      }
      if (terminal && input.effect)
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
      return true;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async claimUnknownSubscriptionCancellationAttempts(limit = 10) {
    const timestamp = now();
    const leaseUntil = new Date(Date.now() + 30_000).toISOString();
    const rows = await this.client.execute({
      sql: "SELECT * FROM support_subscription_cancellation_attempts WHERE status IN ('unknown', 'claimed') AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?) AND (reconcile_lease_until IS NULL OR reconcile_lease_until < ?) ORDER BY COALESCE(next_reconcile_at, created_at), created_at LIMIT ?",
      args: [timestamp, timestamp, limit],
    });
    const claimed = [] as Array<{
      caseId: string;
      turnId: string;
      idempotencyKey: string;
      fingerprint: string;
      command: unknown;
      createdAt: string;
      recoveryClaim: string;
    }>;
    for (const row of rows.rows) {
      const value = row as Record<string, unknown>;
      const recoveryClaim = crypto.randomUUID();
      const write = await this.client.execute({
        sql: "UPDATE support_subscription_cancellation_attempts SET reconcile_lease_token = ?, reconcile_lease_until = ?, updated_at = ? WHERE idempotency_key = ? AND fingerprint = ? AND status IN ('unknown', 'claimed') AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?) AND (reconcile_lease_until IS NULL OR reconcile_lease_until < ?)",
        args: [
          recoveryClaim,
          leaseUntil,
          timestamp,
          String(value.idempotency_key),
          String(value.fingerprint),
          timestamp,
          timestamp,
        ],
      });
      if (Number(write.rowsAffected ?? 0) !== 1) continue;
      claimed.push({
        caseId: String(value.case_id),
        turnId: String(value.turn_id),
        idempotencyKey: String(value.idempotency_key),
        fingerprint: String(value.fingerprint),
        command: JSON.parse(String(value.command_data)),
        createdAt: String(value.created_at),
        recoveryClaim,
      });
    }
    return claimed;
  }
  async rescheduleSubscriptionCancellationRecovery(input: {
    idempotencyKey: string;
    fingerprint: string;
    recoveryClaim: string;
  }) {
    const current = await this.client.execute({
      sql: "SELECT reconcile_attempts FROM support_subscription_cancellation_attempts WHERE idempotency_key = ? AND fingerprint = ? AND reconcile_lease_token = ? AND status IN ('unknown', 'claimed')",
      args: [input.idempotencyKey, input.fingerprint, input.recoveryClaim],
    });
    const attempts = Number(current.rows[0]?.reconcile_attempts ?? 0) + 1;
    const delay = Math.min(
      60 * 60_000,
      30_000 * 2 ** Math.min(attempts - 1, 7),
    );
    const next = new Date(Date.now() + delay).toISOString();
    const write = await this.client.execute({
      sql: "UPDATE support_subscription_cancellation_attempts SET status = 'unknown', reconcile_attempts = ?, next_reconcile_at = ?, reconcile_lease_token = NULL, reconcile_lease_until = NULL, updated_at = ? WHERE idempotency_key = ? AND fingerprint = ? AND reconcile_lease_token = ? AND status IN ('unknown', 'claimed')",
      args: [
        attempts,
        next,
        now(),
        input.idempotencyKey,
        input.fingerprint,
        input.recoveryClaim,
      ],
    });
    return Number(write.rowsAffected ?? 0) === 1;
  }
  /** Atomically closes an uncertain cancellation and records the immutable
   * originating turn's customer notification. A later follow-up keeps the
   * mutable case projection, but cannot lose this terminal result. */
  async finalizeUnknownSubscriptionCancellation(input: {
    idempotencyKey: string;
    fingerprint: string;
    status: "scheduled" | "quarantined" | "failed";
    recoveryClaim?: string;
    effect?: {
      subscriptionId: string;
      cancelAtPeriodEnd: true;
      cancelsAt: string;
      idempotencyKey: string;
      replayed: boolean;
    };
  }) {
    const tx = await this.client.transaction("write");
    try {
      const found = await tx.execute({
        sql: "SELECT * FROM support_subscription_cancellation_attempts WHERE idempotency_key = ? AND fingerprint = ?",
        args: [input.idempotencyKey, input.fingerprint],
      });
      const attempt = found.rows[0] as Record<string, unknown> | undefined;
      if (
        !attempt ||
        !["unknown", "claimed"].includes(String(attempt.status)) ||
        (input.recoveryClaim !== undefined &&
          String(attempt.reconcile_lease_token) !== input.recoveryClaim)
      ) {
        await tx.rollback();
        return false;
      }
      const terminal = await tx.execute({
        sql: "UPDATE support_subscription_cancellation_attempts SET status = ?, cancels_at = COALESCE(?, cancels_at), terminal_at = COALESCE(terminal_at, ?), next_reconcile_at = NULL, reconcile_lease_token = NULL, reconcile_lease_until = NULL, updated_at = ? WHERE idempotency_key = ? AND fingerprint = ? AND status IN ('unknown', 'claimed') AND (? IS NULL OR reconcile_lease_token = ?)",
        args: [
          input.status,
          input.effect?.cancelsAt ?? null,
          now(),
          now(),
          input.idempotencyKey,
          input.fingerprint,
          input.recoveryClaim ?? null,
          input.recoveryClaim ?? null,
        ],
      });
      if (Number(terminal.rowsAffected ?? 0) !== 1) {
        await tx.rollback();
        return false;
      }
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
      const scheduled = input.status === "scheduled";
      const confirmedNoEffect = input.status === "failed";
      const status = scheduled ? "resolved" : "escalated";
      const response = scheduled
        ? `Your subscription is scheduled to cancel at the end of the current billing period on ${input.effect!.cancelsAt}.`
        : "The subscription cancellation requires additional review. A support specialist will follow up shortly.";
      await tx.execute({
        sql: "UPDATE support_turns SET state = ?, outcome_data = json_patch(COALESCE(outcome_data, '{}'), ?), updated_at = ? WHERE id = ? AND case_id = ?",
        args: [
          status,
          JSON.stringify({ status, finalResponse: response }),
          now(),
          turnId,
          current.id,
        ],
      });
      if (scheduled)
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
          args: [
            input.idempotencyKey,
            input.fingerprint,
            JSON.stringify(input.effect),
            now(),
          ],
        });
      else
        await tx.execute({
          sql: "INSERT INTO support_actions(id, case_id, kind, fingerprint, data, created_at) VALUES (?, ?, 'subscription-cancellation-failure', ?, ?, ?) ON CONFLICT(kind, fingerprint) DO UPDATE SET data = excluded.data",
          args: [
            `action_${current.id}_${turnId}_cancellation-failed`,
            current.id,
            input.fingerprint,
            JSON.stringify({
              classification: confirmedNoEffect
                ? "confirmed-no-effect"
                : "unconfirmed-expired",
            }),
            now(),
          ],
        });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'reply', ?, 'pending', ?, 'unknown', ?, ?)",
        args: [
          `outbox_${current.id}_${turnId}_cancellation-${scheduled ? "final" : "failed"}`,
          current.id,
          JSON.stringify(bindingsForCase(current).support),
          response,
          status,
          outboxFingerprint(
            bindingsForCase(current).support,
            "reply",
            response,
            status,
          ),
          turnId,
          now(),
          now(),
        ],
      });
      if (current.metadata.activeTurnId === turnId) {
        const updated = {
          ...current,
          status,
          finalResponse: response,
          escalationReason: scheduled
            ? undefined
            : confirmedNoEffect
              ? "The subscription cancellation could not be completed and requires staff review."
              : "Subscription cancellation could not be confirmed and requires staff review.",
          metadata: scheduled
            ? {
                ...current.metadata,
                cancellationEffect: {
                  subscriptionId: input.effect!.subscriptionId,
                  cancelAtPeriodEnd: true,
                  cancelsAt: input.effect!.cancelsAt,
                  idempotencyKey: input.effect!.idempotencyKey,
                  replayed: input.effect!.replayed,
                },
              }
            : current.metadata,
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
}

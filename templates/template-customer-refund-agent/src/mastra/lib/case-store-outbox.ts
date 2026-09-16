import type { Client } from "@libsql/client";
import type { ProviderBinding } from "../providers/contracts";
import {
  now,
  parse,
  withBindings,
  StaleCaseWriteError,
  outbox,
  OutboxRecord,
} from "./case-store-shared";

const MAX_INTERCOM_PROVIDER_RETRY_DELAY_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_INTERCOM_FALLBACK_RETRY_DELAY_MS = 60_000;

export class CaseStoreOutbox {
  constructor(private readonly client: Client) {}
  async claimOutbox(limit = 10, excludeIds: readonly string[] = []) {
    const claimedAt = now();
    // A durable marker is written before a non-idempotent Intercom POST.  If a
    // process disappears after that point, the remote effect is unknowable and
    // must be escalated rather than reclaimed like an effectless local claim.
    const interrupted = await this.client.execute({
      sql: "SELECT id FROM support_outbox WHERE state = 'started' AND lease_until < ? AND json_extract(binding, '$.providerKind') = 'intercom'",
      args: [claimedAt],
    });
    for (const row of interrupted.rows)
      await this.markOutboxUncertain(
        String(row.id),
        "Intercom operation was interrupted after its durable start marker.",
        undefined,
        "started",
      );
    const exhausted = await this.client.execute({
      sql: "SELECT case_id FROM support_outbox WHERE state = 'claimed' AND lease_until < ? AND attempts >= 3",
      args: [claimedAt],
    });
    for (const row of exhausted.rows) {
      const caseId = String(row.case_id);
      const tx = await this.client.transaction("write");
      try {
        const changed = await tx.execute({
          sql: "UPDATE support_outbox SET state = 'failed', lease_until = NULL, lease_token = NULL, last_error = COALESCE(last_error, 'Delivery lease exhausted after three attempts.'), updated_at = ? WHERE case_id = ? AND state = 'claimed' AND lease_until < ? AND attempts >= 3",
          args: [claimedAt, caseId, claimedAt],
        });
        if (Number(changed.rowsAffected) === 1) {
          const caseRow = await tx.execute({
            sql: "SELECT data, version FROM support_cases WHERE id = ?",
            args: [caseId],
          });
          if (caseRow.rows[0]) {
            const current = parse(caseRow.rows[0] as Record<string, unknown>);
            const updated = withBindings({
              ...current,
              metadata: {
                ...current.metadata,
                deliveryStatus: "failed",
                deliveryError: "Delivery lease exhausted after three attempts.",
              },
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
        }
        await tx.commit();
      } catch (error) {
        try {
          await tx.rollback();
        } catch {}
        throw error;
      }
    }
    const leaseUntil = new Date(Date.now() + 30_000).toISOString();
    const excluded = excludeIds.length
      ? ` AND id NOT IN (${excludeIds.map(() => "?").join(", ")})`
      : "";
    const rows = await this.client.execute({
      // A rate limit blocks its whole provider account, not unrelated tenants.
      // Within a case, earlier undelivered operations fence later operations.
      sql: `SELECT candidate.* FROM support_outbox candidate
        WHERE (candidate.state = 'pending' OR (candidate.state = 'claimed' AND candidate.lease_until < ?))
          AND candidate.attempts < 3
          AND (candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= ?)
          AND NOT EXISTS (SELECT 1 FROM support_outbox_account_limits l WHERE l.tenant_id = json_extract(candidate.binding, '$.tenantId') AND l.provider_kind = json_extract(candidate.binding, '$.providerKind') AND l.provider_account_id = json_extract(candidate.binding, '$.providerAccountId') AND l.blocked_until > ?)
          AND NOT EXISTS (SELECT 1 FROM support_outbox earlier WHERE earlier.case_id = candidate.case_id AND (earlier.created_at < candidate.created_at OR (earlier.created_at = candidate.created_at AND earlier.id < candidate.id)) AND earlier.state NOT IN ('delivered', 'superseded'))
          ${excluded} ORDER BY candidate.created_at, candidate.id LIMIT ?`,
      args: [claimedAt, claimedAt, claimedAt, ...excludeIds, limit],
    });
    const claimed: OutboxRecord[] = [];
    for (const row of rows.rows) {
      const leaseToken = crypto.randomUUID();
      const changed = await this.client.execute({
        sql: `UPDATE support_outbox SET state = 'claimed', attempts = attempts + 1, lease_until = ?, lease_token = ?, updated_at = ? WHERE id = ? AND (state = 'pending' OR (state = 'claimed' AND lease_until < ?)) AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
          AND NOT EXISTS (SELECT 1 FROM support_outbox_account_limits l WHERE l.tenant_id = json_extract(support_outbox.binding, '$.tenantId') AND l.provider_kind = json_extract(support_outbox.binding, '$.providerKind') AND l.provider_account_id = json_extract(support_outbox.binding, '$.providerAccountId') AND l.blocked_until > ?)
          AND NOT EXISTS (SELECT 1 FROM support_outbox earlier WHERE earlier.case_id = support_outbox.case_id AND (earlier.created_at < support_outbox.created_at OR (earlier.created_at = support_outbox.created_at AND earlier.id < support_outbox.id)) AND earlier.state NOT IN ('delivered', 'superseded'))`,
        args: [
          leaseUntil,
          leaseToken,
          claimedAt,
          String(row.id),
          claimedAt,
          claimedAt,
          claimedAt,
        ],
      });
      if (Number(changed.rowsAffected) === 1)
        claimed.push({
          ...outbox(row as Record<string, unknown>, "claimed"),
          attempts: Number(row.attempts) + 1,
          leaseToken,
        });
    }
    return claimed;
  }
  async renewOutboxLease(id: string, leaseToken: string) {
    const updated = await this.client.execute({
      sql: "UPDATE support_outbox SET lease_until = ?, updated_at = ? WHERE id = ? AND lease_token = ? AND state IN ('claimed', 'started')",
      args: [
        new Date(Date.now() + 30_000).toISOString(),
        now(),
        id,
        leaseToken,
      ],
    });
    return Number(updated.rowsAffected) === 1;
  }
  async completeOutbox(id: string, receipt: unknown, leaseToken?: string) {
    const changed = await this.client.execute({
      sql: `UPDATE support_outbox SET state = 'delivered', receipt = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE id = ? AND state IN ('claimed', 'started')${leaseToken ? " AND lease_token = ?" : ""}`,
      args: leaseToken
        ? [JSON.stringify(receipt), now(), id, leaseToken]
        : [JSON.stringify(receipt), now(), id],
    });
    return Number(changed.rowsAffected) === 1;
  }
  async supersedeOutbox(id: string, leaseToken: string, reason: string) {
    const changed = await this.client.execute({
      sql: "UPDATE support_outbox SET state = 'superseded', receipt = ?, last_error = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE id = ? AND state = 'claimed' AND lease_token = ?",
      args: [
        JSON.stringify({ superseded: true, reason }),
        reason,
        now(),
        id,
        leaseToken,
      ],
    });
    return Number(changed.rowsAffected) === 1;
  }
  /** Durable pre-effect boundary for providers without a documented idempotency
   * key.  It is intentionally not used by the local provider's recovery path. */
  async markOutboxStarted(id: string, leaseToken: string) {
    const tx = await this.client.transaction("write");
    try {
      const row = await tx.execute({
        sql: "SELECT case_id, originating_turn_id FROM support_outbox WHERE id = ? AND state = 'claimed' AND lease_token = ? AND lease_until > ?",
        args: [id, leaseToken, now()],
      });
      const current = row.rows[0] as Record<string, unknown> | undefined;
      if (!current) {
        await tx.rollback();
        return false;
      }
      // Manual operations are tied to one immutable turn. This transaction is
      // the first half of the provider-effect fence: appendFollowUp either
      // supersedes this claim first, or sees the started marker and records
      // that reconciliation is required before it commits the new turn.
      if (id.startsWith("manual_")) {
        const caseRow = await tx.execute({
          sql: "SELECT data FROM support_cases WHERE id = ?",
          args: [String(current.case_id)],
        });
        const supportCase = caseRow.rows[0]
          ? parse(caseRow.rows[0] as Record<string, unknown>)
          : undefined;
        if (
          !supportCase ||
          supportCase.metadata.activeTurnId !== current.originating_turn_id
        ) {
          await tx.rollback();
          return false;
        }
      }
      const changed = await tx.execute({
        sql: "UPDATE support_outbox SET state = 'started', updated_at = ? WHERE id = ? AND state = 'claimed' AND lease_token = ? AND lease_until > ?",
        args: [now(), id, leaseToken, now()],
      });
      if (Number(changed.rowsAffected) !== 1) {
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
  /** Called by the adapter after its GET and directly before the POST. */
  async manualOutboxEffectIsCurrent(id: string, leaseToken: string) {
    const row = await this.client.execute({
      sql: "SELECT o.originating_turn_id, c.data FROM support_outbox o JOIN support_cases c ON c.id = o.case_id WHERE o.id = ? AND o.state = 'started' AND o.lease_token = ? AND o.lease_until > ?",
      args: [id, leaseToken, now()],
    });
    const current = row.rows[0] as Record<string, unknown> | undefined;
    return Boolean(
      current &&
      parse(current).metadata.activeTurnId === current.originating_turn_id,
    );
  }
  /** A follow-up won before the adapter POST. Preserve the row as audit
   * history but let later, already-superseded rows stop blocking the queue. */
  async supersedeManualOutboxAfterFence(
    id: string,
    receipt: unknown,
    reason: string,
  ) {
    const changed = await this.client.execute({
      sql: "UPDATE support_outbox SET state = 'superseded', receipt = ?, last_error = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE id = ? AND state = 'uncertain'",
      args: [JSON.stringify(receipt), reason, now(), id],
    });
    return Number(changed.rowsAffected) === 1;
  }
  async manualOutboxNeedsReopen(id: string) {
    const row = await this.client.execute({
      sql: "SELECT o.originating_turn_id, c.data FROM support_outbox o JOIN support_cases c ON c.id = o.case_id WHERE o.id = ? AND o.state = 'uncertain'",
      args: [id],
    });
    const current = row.rows[0] as Record<string, unknown> | undefined;
    if (!current) return false;
    const supportCase = parse(current);
    return (
      supportCase.metadata.activeTurnId !== current.originating_turn_id &&
      supportCase.status !== "resolved"
    );
  }
  async manualOutboxIsUncertain(id: string) {
    const row = await this.client.execute({
      sql: "SELECT id FROM support_outbox WHERE id = ? AND state = 'uncertain'",
      args: [id],
    });
    return Boolean(row.rows[0]);
  }
  /** The reopen POST has its own durable intent. A crash afterwards remains
   * uncertain and is never automatically replayed. */
  async markManualOutboxReconciliationStarted(id: string) {
    const changed = await this.client.execute({
      sql: "UPDATE support_outbox SET receipt = ?, last_error = ?, updated_at = ? WHERE id = ? AND state = 'uncertain'",
      args: [
        JSON.stringify({ reconciliation: "started" }),
        "A stale manual close may have reached Intercom; reopening is being reconciled.",
        now(),
        id,
      ],
    });
    return Number(changed.rowsAffected) === 1;
  }
  /** A POST with an unknown outcome is never eligible for automatic replay.
   * Persist it visibly and project an escalation marker for staff recovery. */
  async markOutboxUncertain(
    id: string,
    error: unknown,
    leaseToken?: string,
    expectedState?: "claimed" | "started",
  ) {
    const tx = await this.client.transaction("write");
    try {
      const changed = await tx.execute({
        sql: `UPDATE support_outbox SET state = 'uncertain', last_error = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE id = ?${leaseToken ? " AND lease_token = ?" : ""}${expectedState ? " AND state = ?" : ""}`,
        args: [
          String(error),
          now(),
          id,
          ...(leaseToken ? [leaseToken] : []),
          ...(expectedState ? [expectedState] : []),
        ],
      });
      if (Number(changed.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      const outbox = await tx.execute({
        sql: "SELECT case_id FROM support_outbox WHERE id = ?",
        args: [id],
      });
      const caseId = outbox.rows[0]
        ? String(outbox.rows[0].case_id)
        : undefined;
      if (caseId) {
        const row = await tx.execute({
          sql: "SELECT data, version FROM support_cases WHERE id = ?",
          args: [caseId],
        });
        if (row.rows[0]) {
          const current = parse(row.rows[0] as Record<string, unknown>);
          const updated = withBindings({
            ...current,
            status: "escalated",
            escalationReason:
              "Outbound Intercom effect has an uncertain remote outcome and requires manual reconciliation.",
            metadata: {
              ...current.metadata,
              deliveryStatus: "uncertain",
              deliveryError: String(error),
            },
            updatedAt: now(),
          });
          const write = await tx.execute({
            sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
            args: [
              JSON.stringify(updated),
              updated.updatedAt,
              caseId,
              Number(row.rows[0].version ?? 1),
            ],
          });
          if (Number(write.rowsAffected) !== 1)
            throw new StaleCaseWriteError(caseId);
        }
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
  async retryOutbox(
    id: string,
    error: unknown,
    terminal = false,
    leaseToken?: string,
    retryAfterMs?: number,
    rateLimited = false,
  ) {
    const tx = await this.client.transaction("write");
    try {
      // The terminal case projection is part of the same fenced transition as
      // the outbox row.  A stale worker therefore cannot overwrite the case
      // after the current owner has delivered the item.
      const outboxRow = await tx.execute({
        sql: "SELECT binding, attempts FROM support_outbox WHERE id = ?",
        args: [id],
      });
      const binding = outboxRow.rows[0]
        ? (JSON.parse(String(outboxRow.rows[0].binding)) as ProviderBinding)
        : undefined;
      const providerDelayIsValid =
        retryAfterMs === undefined ||
        (Number.isFinite(retryAfterMs) &&
          retryAfterMs >= 0 &&
          retryAfterMs <= MAX_INTERCOM_PROVIDER_RETRY_DELAY_MS);
      if (
        !terminal &&
        binding?.providerKind === "intercom" &&
        !providerDelayIsValid
      ) {
        // A provider-directed delay we cannot represent must be surfaced as a
        // terminal local failure. Never silently bring the retry forward.
        terminal = true;
        error = `Permanent: Intercom provider retry delay is outside scheduler bounds. ${String(error)}`;
      }
      // Provider-directed waits are retained exactly. Exponential fallback is
      // separately bounded for local operational recovery.
      const retryDelayMs =
        retryAfterMs ??
        Math.min(
          Math.max(
            1_000 * 2 ** Number(outboxRow.rows[0]?.attempts ?? 1),
            1_000,
          ),
          MAX_INTERCOM_FALLBACK_RETRY_DELAY_MS,
        );
      const retryAt =
        !terminal && binding?.providerKind === "intercom"
          ? new Date(Date.now() + retryDelayMs).toISOString()
          : null;
      if (rateLimited && !terminal && binding?.providerKind === "intercom") {
        await tx.execute({
          sql: "INSERT INTO support_outbox_account_limits(tenant_id, provider_kind, provider_account_id, blocked_until, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, provider_kind, provider_account_id) DO UPDATE SET blocked_until = CASE WHEN excluded.blocked_until > blocked_until THEN excluded.blocked_until ELSE blocked_until END, updated_at = excluded.updated_at",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            retryAt!,
            now(),
          ],
        });
      }
      const changed = await tx.execute({
        sql: `UPDATE support_outbox SET state = ?, last_error = ?, next_attempt_at = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE id = ?${leaseToken ? " AND lease_token = ?" : ""}`,
        args: leaseToken
          ? [
              terminal ? "failed" : "pending",
              String(error),
              retryAt,
              now(),
              id,
              leaseToken,
            ]
          : [
              terminal ? "failed" : "pending",
              String(error),
              retryAt,
              now(),
              id,
            ],
      });
      if (Number(changed.rowsAffected) !== 1) {
        await tx.rollback();
        return false;
      }
      if (terminal) {
        const outbox = await tx.execute({
          sql: "SELECT case_id FROM support_outbox WHERE id = ?",
          args: [id],
        });
        const caseId = outbox.rows[0]
          ? String(outbox.rows[0].case_id)
          : undefined;
        if (caseId) {
          const row = await tx.execute({
            sql: "SELECT data, version FROM support_cases WHERE id = ?",
            args: [caseId],
          });
          if (row.rows[0]) {
            const current = parse(row.rows[0] as Record<string, unknown>);
            const updated = withBindings({
              ...current,
              metadata: {
                ...current.metadata,
                deliveryStatus: "failed",
                deliveryError: String(error),
              },
              updatedAt: now(),
            });
            const caseWrite = await tx.execute({
              sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
              args: [
                JSON.stringify(updated),
                updated.updatedAt,
                caseId,
                Number(row.rows[0].version ?? 1),
              ],
            });
            if (Number(caseWrite.rowsAffected) !== 1)
              throw new StaleCaseWriteError(caseId);
          }
        }
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

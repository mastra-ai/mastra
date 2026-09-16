import type { Client } from "@libsql/client";
import type { SupportCase } from "../domain/support-case.ts";
import {
  parseLegacyCase,
  financialRetentionTombstone,
  caseBinding,
  retentionPolicyFromEnvironment,
  StaleCaseWriteError,
} from "./case-store-shared.ts";
import type { RetentionPolicy, RetentionResult } from "./case-store-shared.ts";

export class CaseStoreRetention {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }
  async enforceRetention(
    clock: () => Date = () => new Date(),
    policy: RetentionPolicy = retentionPolicyFromEnvironment(),
  ): Promise<RetentionResult> {
    const current = clock();
    const cutoff = (days: number) =>
      new Date(current.getTime() - days * 24 * 60 * 60 * 1_000).toISOString();
    const rawCutoff = cutoff(policy.rawPayloadDays);
    const traceCutoff = cutoff(policy.traceDays);
    const caseCutoff = cutoff(policy.caseDays);
    const auditCutoff = cutoff(policy.financialAuditDays);
    // These records contain only correlation identifiers, but their trace
    // binding must not outlive the 30-day observability retention window.
    // A missing table is valid only while upgrading a pre-v12 database.
    let supervisorExecutionsDeleted = 0;
    try {
      const deleted = await this.client.execute({
        sql: "DELETE FROM support_supervisor_executions WHERE created_at < ?",
        args: [traceCutoff],
      });
      supervisorExecutionsDeleted = Number(deleted.rowsAffected ?? 0);
    } catch (error) {
      if (!String(error).includes("no such table")) throw error;
    }
    const rows = await this.client.execute(
      "SELECT id, data, version, created_at, accepted_at FROM support_cases WHERE COALESCE(accepted_at, created_at) < ? OR updated_at < ?",
      [rawCutoff, traceCutoff],
    );
    let rawPayloadsRedacted = 0;
    let casesRedacted = 0;
    let tracesRedacted = 0;
    let messagesDeleted = 0;
    let turnsRedacted = 0;
    let outboxRecordsRedacted = 0;
    let dispatchesExpired = 0;
    let decisionsRedacted = 0;
    let actionsRedacted = 0;
    let feedbackDeleted = 0;
    let auditPayloadsRedacted = 0;
    let financialReasonsRedacted = 0;
    let pendingCasesExpired = 0;
    const expiredCaseIds = new Set<string>();
    const expiredWorkflowRunIds = new Set<string>();
    for (const row of rows.rows) {
      const id = String(row.id);
      // Historical contaminated tombstones must be readable only long enough
      // for this repair path to redact them into the current retained shape.
      const supportCase = parseLegacyCase(row as Record<string, unknown>);
      const acceptedAt = String(row.accepted_at ?? row.created_at);
      const metadata = { ...supportCase.metadata };
      // A prior supported-storage delete may have failed after this durable
      // tombstone committed. Keep the case association in later sweeps so
      // snapshot cleanup is retryable without retaining a content copy forever.
      if (metadata.retentionRedactedAt !== undefined) expiredCaseIds.add(id);
      let changed = false;
      let deleteMessages = false;
      if (acceptedAt < rawCutoff && "rawPayload" in metadata) {
        delete metadata.rawPayload;
        rawPayloadsRedacted += 1;
        changed = true;
      }
      let updated: SupportCase = { ...supportCase, metadata };
      if (acceptedAt < traceCutoff && updated.traceId) {
        updated = { ...updated, traceId: undefined };
        tracesRedacted += 1;
        changed = true;
      }
      // Tombstones are normally clean after their first sweep, but a previous
      // version allowed content to be appended after the tombstone marker was
      // written. Check every durable content projection before deciding that a
      // marked case needs no work; otherwise table-only leftovers would live
      // forever because the case JSON is already minimal.
      const residualContent =
        acceptedAt < caseCutoff && metadata.retentionRedactedAt !== undefined
          ? await this.client.execute({
              sql: `SELECT 1 FROM support_messages WHERE case_id = ?
                UNION ALL SELECT 1 FROM support_turns WHERE case_id = ? AND (message_data IS NOT NULL OR outcome_data IS NOT NULL)
                UNION ALL SELECT 1 FROM support_outbox WHERE case_id = ? AND (body <> '[redacted]' OR receipt IS NOT NULL OR last_error IS NOT NULL)
                UNION ALL SELECT 1 FROM support_decisions WHERE case_id = ? AND note IS NOT NULL
                UNION ALL SELECT 1 FROM support_actions WHERE case_id = ? AND data <> '{}'
                UNION ALL SELECT 1 FROM support_feedback WHERE case_id = ?
                LIMIT 1`,
              args: [id, id, id, id, id, id],
            })
          : undefined;
      if (
        acceptedAt < caseCutoff &&
        (metadata.retentionRedactedAt === undefined ||
          supportCase.messages.length > 0 ||
          supportCase.approval !== undefined ||
          supportCase.feedback !== undefined ||
          supportCase.customer.email !== "redacted@invalid.local" ||
          supportCase.subject !== "Redacted support case" ||
          supportCase.finalResponse !== undefined ||
          supportCase.draft !== undefined ||
          Boolean(residualContent?.rows[0]))
      ) {
        const binding = caseBinding(supportCase);
        const wasPending = ["new", "processing", "waiting_approval"].includes(
          supportCase.status,
        );
        const command = metadata.refundCommand;
        const subscriptionCreditCommand = metadata.subscriptionCreditCommand;
        updated = {
          ...updated,
          customer: { email: "redacted@invalid.local" },
          subject: "Redacted support case",
          messages: [],
          approval: undefined,
          ...(wasPending
            ? {
                // Closing a stale in-flight case fails closed. Keep only a
                // non-executable fingerprint/replay reference for audit and
                // reconciliation; the decision route rejects this status.
                status: "failed" as const,
              }
            : {}),
          triage: undefined,
          policyMatches: undefined,
          orderLookup: undefined,
          subscriptionLookup: undefined,
          refundHistory: undefined,
          draft: undefined,
          finalResponse: undefined,
          escalationReason: wasPending
            ? "Pending case expired under DEC-015 before a financial decision."
            : undefined,
          feedback: undefined,
          agentUsage: undefined,
          traceId: undefined,
          metadata: {
            providerBinding: binding,
            retentionRedactedAt: current.toISOString(),
            ...(wasPending
              ? {
                  pendingRetentionExpiredAt: current.toISOString(),
                  ...(command?.fingerprint
                    ? {
                        refundCommand: {
                          fingerprint: command.fingerprint,
                          ...(command.idempotencyKey
                            ? { idempotencyKey: command.idempotencyKey }
                            : {}),
                        },
                      }
                    : {}),
                  ...(subscriptionCreditCommand?.fingerprint
                    ? {
                        subscriptionCreditCommand: {
                          fingerprint: subscriptionCreditCommand.fingerprint,
                          ...(subscriptionCreditCommand.idempotencyKey
                            ? {
                                idempotencyKey:
                                  subscriptionCreditCommand.idempotencyKey,
                              }
                            : {}),
                        },
                      }
                    : {}),
                }
              : {}),
          },
        };
        if (wasPending) pendingCasesExpired += 1;
        casesRedacted += 1;
        expiredCaseIds.add(id);
        if (supportCase.workflowRunId)
          expiredWorkflowRunIds.add(supportCase.workflowRunId);
        const nativeApproval = metadata.nativeApproval;
        if (typeof nativeApproval?.runId === "string")
          expiredWorkflowRunIds.add(nativeApproval.runId);
        const dispatchedRuns = await this.client.execute({
          sql: "SELECT run_id FROM support_dispatch WHERE case_id = ?",
          args: [id],
        });
        for (const run of dispatchedRuns.rows)
          expiredWorkflowRunIds.add(String(run.run_id));
        const nativeRuns = await this.client.execute({
          sql: "SELECT native_run_id FROM support_decisions WHERE case_id = ? AND native_run_id IS NOT NULL",
          args: [id],
        });
        for (const run of nativeRuns.rows)
          expiredWorkflowRunIds.add(String(run.native_run_id));
        const turnRuns = await this.client.execute({
          sql: "SELECT run_id FROM support_turns WHERE case_id = ? AND run_id IS NOT NULL",
          args: [id],
        });
        for (const run of turnRuns.rows)
          expiredWorkflowRunIds.add(String(run.run_id));
        deleteMessages = true;
        changed = true;
      }
      if (changed) {
        const tx = await this.client.transaction("write");
        try {
          const write = await tx.execute({
            sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
            args: [
              JSON.stringify(updated),
              current.toISOString(),
              id,
              Number(row.version ?? 1),
            ],
          });
          if (Number(write.rowsAffected ?? 0) !== 1)
            throw new StaleCaseWriteError(id);
          if (deleteMessages) {
            const deleted = await tx.execute({
              sql: "DELETE FROM support_messages WHERE case_id = ?",
              args: [id],
            });
            messagesDeleted += Number(deleted.rowsAffected ?? 0);
            const turns = await tx.execute({
              sql: "UPDATE support_turns SET message_data = NULL, outcome_data = NULL, updated_at = ? WHERE case_id = ? AND (message_data IS NOT NULL OR outcome_data IS NOT NULL)",
              args: [current.toISOString(), id],
            });
            turnsRedacted += Number(turns.rowsAffected ?? 0);
            // Expire in-flight authority before removing its native snapshot.
            // The retained row remains a non-executable audit/replay reference.
            const dispatches = await tx.execute({
              sql: "UPDATE support_dispatch SET state = CASE WHEN state IN ('pending', 'claimed', 'started', 'suspended') THEN 'failed' ELSE state END, lease_until = NULL, lease_token = NULL, last_error = NULL, updated_at = ? WHERE case_id = ?",
              args: [current.toISOString(), id],
            });
            dispatchesExpired += Number(dispatches.rowsAffected ?? 0);
            const outbox = await tx.execute({
              sql: "UPDATE support_outbox SET body = '[redacted]', receipt = NULL, last_error = NULL, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE case_id = ? AND (body <> '[redacted]' OR receipt IS NOT NULL OR last_error IS NOT NULL)",
              args: [current.toISOString(), id],
            });
            outboxRecordsRedacted += Number(outbox.rowsAffected ?? 0);
            const decisions = await tx.execute({
              sql: "UPDATE support_decisions SET note = NULL WHERE case_id = ? AND note IS NOT NULL",
              args: [id],
            });
            decisionsRedacted += Number(decisions.rowsAffected ?? 0);
            const actions = await tx.execute({
              sql: "UPDATE support_actions SET data = '{}' WHERE case_id = ? AND data <> '{}'",
              args: [id],
            });
            actionsRedacted += Number(actions.rowsAffected ?? 0);
            // Ratings/comments are customer content. Aggregates only include
            // retained feedback; a tombstoned case cannot retain its rating.
            const feedback = await tx.execute({
              sql: "DELETE FROM support_feedback WHERE case_id = ?",
              args: [id],
            });
            feedbackDeleted += Number(feedback.rowsAffected ?? 0);
          }
          await tx.commit();
        } catch (error) {
          try {
            await tx.rollback();
          } catch {}
          throw error;
        }
      }
    }
    const audits = await this.client.execute({
      sql: "DELETE FROM support_audit WHERE created_at < ?",
      args: [auditCutoff],
    });
    // LocalRuntime owns the financial table and may not be initialized in a
    // storage-only invocation. If it exists, its freeform reason follows the
    // case-content window while the immutable financial identifiers remain.
    try {
      const financialReasons = await this.client.execute({
        sql: "UPDATE local_refunds SET reason = '[redacted]' WHERE issued_at < ? AND reason <> '[redacted]'",
        args: [caseCutoff],
      });
      financialReasonsRedacted += Number(financialReasons.rowsAffected ?? 0);
    } catch (error) {
      if (!String(error).includes("no such table")) throw error;
    }
    try {
      const creditReasons = await this.client.execute({
        sql: "UPDATE local_subscription_credits SET reason = '[redacted]' WHERE issued_at < ? AND reason <> '[redacted]'",
        args: [caseCutoff],
      });
      financialReasonsRedacted += Number(creditReasons.rowsAffected ?? 0);
    } catch (error) {
      if (!String(error).includes("no such table")) throw error;
    }
    // Stripe attempts retain an immutable command for reconciliation, but its
    // free-form reason is customer content and follows the normal case window.
    try {
      const stripeReasons = await this.client.execute({
        sql: "UPDATE support_stripe_refund_attempts SET command_data = json_set(command_data, '$.reason', '[redacted]') WHERE created_at < ? AND command_data IS NOT NULL AND json_extract(command_data, '$.reason') <> '[redacted]'",
        args: [caseCutoff],
      });
      financialReasonsRedacted += Number(stripeReasons.rowsAffected ?? 0);
      const stripeCreditReasons = await this.client.execute({
        sql: "UPDATE support_stripe_subscription_credit_attempts SET command_data = json_set(command_data, '$.reason', '[redacted]') WHERE created_at < ? AND command_data IS NOT NULL AND json_extract(command_data, '$.reason') <> '[redacted]'",
        args: [caseCutoff],
      });
      financialReasonsRedacted += Number(stripeCreditReasons.rowsAffected ?? 0);
      // At the financial-audit boundary provider IDs and immutable command
      // metadata are no longer retained. Before removing a terminal attempt,
      // irreversibly replace any effect with a non-executable tombstone. The
      // original created_at is preserved, so this does not extend retention.
      // Pending/unknown attempts remain untouched because their external
      // outcome is unresolved and must never be reissued.
      await this.minimizeExpiredTerminalFinancialAttempts(auditCutoff);
      // Unrelated webhook receipt records are replay protection only. They do
      // not need a financial-audit lifetime and must not retain provider IDs.
      await this.client.execute({
        sql: "DELETE FROM support_actions WHERE case_id = 'stripe-webhook' AND kind = 'event' AND created_at < ?",
        args: [rawCutoff],
      });
      // A completed/failed receipt holds only an event ID and no raw payload,
      // but it still follows the seven-day webhook boundary. Never delete an
      // active lease: its owner may be completing a durable reconciliation, or
      // a later signed delivery may need to recover it after expiry.
      await this.client.execute({
        sql: "DELETE FROM support_stripe_webhook_receipts WHERE created_at < ? AND state IN ('completed', 'failed')",
        args: [rawCutoff],
      });
      // Reverse-close hints carry external conversation identifiers. Retain a
      // live lease for recovery, but drop terminal dedupe records at the same
      // webhook boundary. Manual command receipts are case-scoped audit data,
      // so their replay metadata cannot outlive the case-content window.
      await this.client.execute({
        sql: "DELETE FROM support_intercom_close_intents WHERE created_at < ? AND state IN ('applied', 'superseded')",
        args: [rawCutoff],
      });
      await this.client.execute({
        sql: "DELETE FROM support_manual_resolutions WHERE created_at < ?",
        args: [caseCutoff],
      });
    } catch (error) {
      if (!String(error).includes("no such table")) throw error;
    }
    return {
      rawPayloadsRedacted,
      casesRedacted,
      tracesRedacted,
      supervisorExecutionsDeleted,
      auditsDeleted: Number(audits.rowsAffected ?? 0),
      messagesDeleted,
      turnsRedacted,
      outboxRecordsRedacted,
      dispatchesExpired,
      decisionsRedacted,
      actionsRedacted,
      feedbackDeleted,
      auditPayloadsRedacted,
      financialReasonsRedacted,
      // Mastra owns its tables. The configured LibSQLStore retention policy
      // removes its messages, resources, threads, and spans via storage.prune.
      mastraMessagesDeleted: 0,
      mastraSpansDeleted: 0,
      pendingCasesExpired,
      rawWorkflowSnapshotBefore: rawCutoff,
      expiredCaseIds: [...expiredCaseIds],
      expiredWorkflowRunIds: [...expiredWorkflowRunIds],
    };
  }
  /** Atomically remove identifying terminal attempts only after installing a
   * minimal idempotency tombstone. This covers failed/quarantined attempts
   * whose success effect was already removed by a late provider failure. */
  private async minimizeExpiredTerminalFinancialAttempts(auditCutoff: string) {
    const tx = await this.client.transaction("write");
    try {
      const candidates = await Promise.all([
        tx.execute({
          sql: "SELECT idempotency_key, command_fingerprint AS fingerprint, created_at FROM support_stripe_refund_attempts WHERE status IN ('succeeded', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
          args: [auditCutoff],
        }),
        tx.execute({
          sql: "SELECT idempotency_key, fingerprint, created_at FROM support_subscription_cancellation_attempts WHERE status IN ('scheduled', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
          args: [auditCutoff],
        }),
        tx.execute({
          sql: "SELECT idempotency_key, command_fingerprint AS fingerprint, created_at FROM support_stripe_subscription_credit_attempts WHERE status IN ('succeeded', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
          args: [auditCutoff],
        }),
      ]);
      for (const result of candidates)
        for (const row of result.rows) {
          const key = String(row.idempotency_key);
          const fingerprint = String(row.fingerprint);
          const existing = await tx.execute({
            sql: "SELECT fingerprint FROM support_idempotency WHERE idempotency_key = ?",
            args: [key],
          });
          if (
            existing.rows[0] &&
            String(existing.rows[0].fingerprint) !== fingerprint
          )
            throw new Error(
              "Terminal financial attempt conflicts with its idempotency fingerprint.",
            );
          if (existing.rows[0])
            await tx.execute({
              sql: "UPDATE support_idempotency SET effect = ? WHERE idempotency_key = ? AND fingerprint = ?",
              args: [
                JSON.stringify(financialRetentionTombstone),
                key,
                fingerprint,
              ],
            });
          else
            await tx.execute({
              sql: "INSERT INTO support_idempotency(idempotency_key, fingerprint, effect, created_at) VALUES (?, ?, ?, ?)",
              args: [
                key,
                fingerprint,
                JSON.stringify(financialRetentionTombstone),
                String(row.created_at),
              ],
            });
        }
      await tx.execute({
        sql: "DELETE FROM support_stripe_refund_attempts WHERE status IN ('succeeded', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
        args: [auditCutoff],
      });
      await tx.execute({
        sql: "DELETE FROM support_subscription_cancellation_attempts WHERE status IN ('scheduled', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
        args: [auditCutoff],
      });
      await tx.execute({
        sql: "DELETE FROM support_stripe_subscription_credit_reservations WHERE status IN ('succeeded', 'failed', 'quarantined') AND updated_at < ?",
        args: [auditCutoff],
      });
      await tx.execute({
        sql: "DELETE FROM support_stripe_subscription_credit_attempts WHERE status IN ('succeeded', 'failed', 'quarantined') AND COALESCE(terminal_at, created_at) < ?",
        args: [auditCutoff],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

import type { Client } from "@libsql/client";
import type { SupportCase } from "../domain/support-case";
import { now } from "./case-store-shared";

/** Shared fail-closed fence for human and provider-originated resolution. It
 * deliberately treats ambiguous attempts and active recovery leases as work in
 * progress; neither resolver may guess whether a financial effect happened. */
export async function hasResolutionBlocker(
  tx: Awaited<ReturnType<Client["transaction"]>>,
  caseId: string,
  supportCase: SupportCase,
) {
  if (
    supportCase.refundResult?.status === "pending" ||
    supportCase.subscriptionCreditResult?.status === "pending"
  )
    return true;
  if (
    (supportCase.metadata.refundCommand &&
      supportCase.approval?.approved &&
      !supportCase.refundResult) ||
    (supportCase.metadata.subscriptionCreditCommand &&
      supportCase.approval?.approved &&
      !supportCase.subscriptionCreditResult)
  )
    return true;
  const checks = [
    "SELECT 1 FROM support_dispatch WHERE case_id = ? AND state IN ('pending','claimed','started','suspended') LIMIT 1",
    // Commands are immutable per turn. A newer follow-up clears the current
    // projection, so inspect the turn/decision history rather than relying on
    // metadata from only the latest turn.
    `SELECT 1 FROM support_turns t
      LEFT JOIN support_decisions d ON d.case_id = t.case_id AND d.turn_id = t.id AND d.command_fingerprint = t.command_fingerprint
      WHERE t.case_id = ? AND t.command_fingerprint IS NOT NULL AND (
        d.id IS NULL OR
        (d.approved = 1 AND
          COALESCE(json_extract(t.outcome_data, '$.refundResult.status'), '') NOT IN ('executed','skipped','failed') AND
          COALESCE(json_extract(t.outcome_data, '$.subscriptionCreditResult.status'), '') NOT IN ('executed','skipped','failed') AND
          json_extract(t.outcome_data, '$.cancellationEffect') IS NULL)
      ) LIMIT 1`,
    "SELECT 1 FROM support_stripe_refund_attempts WHERE case_id = ? AND (status IN ('prepared','pending','unknown','quarantined') OR reconcile_lease_until > ?) LIMIT 1",
    "SELECT 1 FROM support_stripe_subscription_credit_attempts WHERE case_id = ? AND status IN ('prepared','unknown','quarantined') LIMIT 1",
    "SELECT 1 FROM support_subscription_cancellation_attempts WHERE case_id = ? AND (status IN ('prepared','claimed','unknown','quarantined') OR reconcile_lease_until > ?) LIMIT 1",
  ];
  for (const sql of checks) {
    const result = await tx.execute({
      sql,
      args: (sql.match(/\?/g)?.length ?? 0) === 2 ? [caseId, now()] : [caseId],
    });
    if (result.rows[0]) return true;
  }
  return false;
}

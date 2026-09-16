import type { Client } from "@libsql/client";
import type { CaseMessage } from "../domain/support-case";
import { activeDispatchLeaseScope } from "./dispatch-lease-scope";
import {
  now,
  parse,
  withBindings,
  StaleCaseWriteError,
  outboxFingerprint,
  OutboxRecord,
} from "./case-store-shared";

export class CaseStoreFinalization {
  constructor(private readonly client: Client) {}
  async enqueueDelivery(record: Omit<OutboxRecord, "state" | "attempts">) {
    const operation = record.operation ?? "reply";
    const payloadFingerprint =
      record.payloadFingerprint ??
      outboxFingerprint(record.binding, operation, record.body, record.status);
    await this.client.execute({
      sql: "INSERT INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, originating_run_id, originating_trace_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)",
      args: [
        record.id,
        record.caseId,
        JSON.stringify(record.binding),
        record.body,
        record.status,
        operation,
        payloadFingerprint,
        record.originatingTurnId ?? null,
        record.originatingRunId ?? null,
        record.originatingTraceId ?? null,
        record.correlationState ?? "unknown",
        now(),
        now(),
      ],
    });
  }
  /** The terminal case view, agent reply and delivery intent are one durable
   * decision.  Replays accept the same deterministic records and reject a
   * mismatched finalization instead of creating another customer reply. */
  async finalizeCaseAndEnqueue(input: {
    caseId: string;
    turnId: string;
    status: "resolved" | "escalated";
    finalResponse: string;
    escalationReason?: string;
    message: CaseMessage;
    outbox: Omit<OutboxRecord, "state" | "attempts">;
    additionalOutbox?: Array<Omit<OutboxRecord, "state" | "attempts">>;
  }) {
    const tx = await this.client.transaction("write");
    try {
      const rowResult = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = rowResult.rows[0];
      if (!row) throw new Error(`Support case not found: ${input.caseId}`);
      const current = parse(row as Record<string, unknown>);
      if (current.metadata.activeTurnId !== input.turnId)
        throw new StaleCaseWriteError(input.caseId);
      const lease = activeDispatchLeaseScope();
      if (lease) {
        if (lease.caseId !== input.caseId || lease.turnId !== input.turnId)
          throw new Error(
            "Workflow dispatch scope cannot finalize another turn.",
          );
        const owned = await tx.execute({
          sql: "SELECT id FROM support_dispatch WHERE id = ? AND case_id = ? AND turn_id = ? AND lease_token = ? AND state IN ('claimed', 'started') AND lease_until > ?",
          args: [
            lease.dispatchId,
            lease.caseId,
            lease.turnId,
            lease.leaseToken,
            now(),
          ],
        });
        if (!owned.rows[0])
          throw new StaleCaseWriteError(
            `Dispatch lease is no longer current for ${input.caseId}.`,
          );
      }
      const priorOutcome = await tx.execute({
        sql: "SELECT run_id, outcome_data FROM support_turns WHERE id = ? AND case_id = ?",
        args: [input.turnId, input.caseId],
      });
      const existingOutcome = priorOutcome.rows[0]?.outcome_data
        ? (JSON.parse(String(priorOutcome.rows[0].outcome_data)) as {
            finalResponse?: string;
            status?: string;
            telemetry?: { traceId?: unknown };
            [key: string]: unknown;
          })
        : undefined;
      // Telemetry is attached before terminalization.  It is not itself a
      // terminal outcome, so only a prior final response can participate in
      // replay-conflict detection.
      if (existingOutcome?.finalResponse !== undefined) {
        const outcome = existingOutcome;
        if (
          outcome.finalResponse !== input.finalResponse ||
          outcome.status !== input.status
        )
          throw new Error(
            "Conflicting replay attempted to finalize a support turn.",
          );
      }
      if (
        current.finalResponse !== undefined &&
        (current.finalResponse !== input.finalResponse ||
          current.status !== input.status)
      )
        throw new Error(
          "Conflicting replay attempted to finalize a support case.",
        );
      const hasMessage = current.messages.some(
        (message) => message.id === input.message.id,
      );
      const updated = withBindings({
        ...current,
        status: input.status,
        finalResponse: input.finalResponse,
        escalationReason: input.escalationReason,
        messages: hasMessage
          ? current.messages
          : [...current.messages, input.message],
        updatedAt: now(),
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
        sql: "INSERT OR IGNORE INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
        args: [
          input.message.id,
          input.caseId,
          JSON.stringify(input.message),
          input.message.createdAt,
        ],
      });
      await tx.execute({
        sql: "UPDATE support_turns SET state = ?, outcome_data = ?, updated_at = ? WHERE id = ? AND case_id = ?",
        args: [
          input.status,
          JSON.stringify({
            ...existingOutcome,
            status: input.status,
            finalResponse: input.finalResponse,
            escalationReason: input.escalationReason,
            approval: updated.approval,
            refundResult: updated.refundResult,
            subscriptionCreditResult: updated.subscriptionCreditResult,
            draft: updated.draft,
          }),
          now(),
          input.turnId,
          input.caseId,
        ],
      });
      const operation = input.outbox.operation ?? "reply";
      const payloadFingerprint =
        input.outbox.payloadFingerprint ??
        outboxFingerprint(
          input.outbox.binding,
          operation,
          input.outbox.body,
          input.outbox.status,
        );
      const prior = await tx.execute({
        sql: "SELECT case_id, binding, body, status, operation, payload_fingerprint, originating_turn_id, originating_run_id, originating_trace_id, correlation_state FROM support_outbox WHERE id = ?",
        args: [input.outbox.id],
      });
      if (prior.rows[0]) {
        const existing = prior.rows[0] as Record<string, unknown>;
        if (
          String(existing.case_id) !== input.caseId ||
          String(existing.body) !== input.outbox.body ||
          String(existing.status) !== input.outbox.status ||
          String(existing.binding) !== JSON.stringify(input.outbox.binding) ||
          String(existing.operation ?? "reply") !== operation ||
          String(existing.payload_fingerprint ?? "") !== payloadFingerprint
        )
          throw new Error(
            "Conflicting replay attempted to enqueue a delivery.",
          );
      } else {
        await tx.execute({
          sql: "INSERT INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, originating_run_id, originating_trace_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)",
          args: [
            input.outbox.id,
            input.caseId,
            JSON.stringify(input.outbox.binding),
            input.outbox.body,
            input.outbox.status,
            operation,
            payloadFingerprint,
            input.turnId,
            priorOutcome.rows[0]?.run_id
              ? String(priorOutcome.rows[0].run_id)
              : null,
            typeof existingOutcome?.telemetry?.traceId === "string"
              ? existingOutcome.telemetry.traceId
              : null,
            typeof existingOutcome?.telemetry?.traceId === "string"
              ? "known"
              : "unknown",
            now(),
            now(),
          ],
        });
      }
      for (const extra of input.additionalOutbox ?? []) {
        const extraOperation = extra.operation ?? "reply";
        const extraFingerprint =
          extra.payloadFingerprint ??
          outboxFingerprint(
            extra.binding,
            extraOperation,
            extra.body,
            extra.status,
          );
        const existing = await tx.execute({
          sql: "SELECT case_id, binding, body, status, operation, payload_fingerprint FROM support_outbox WHERE id = ?",
          args: [extra.id],
        });
        if (existing.rows[0]) {
          const row = existing.rows[0] as Record<string, unknown>;
          if (
            String(row.case_id) !== input.caseId ||
            String(row.binding) !== JSON.stringify(extra.binding) ||
            String(row.body) !== extra.body ||
            String(row.status) !== extra.status ||
            String(row.operation ?? "reply") !== extraOperation ||
            String(row.payload_fingerprint ?? "") !== extraFingerprint
          )
            throw new Error(
              "Conflicting replay attempted to enqueue an additional delivery.",
            );
          continue;
        }
        await tx.execute({
          sql: "INSERT INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, originating_turn_id, originating_run_id, originating_trace_id, correlation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)",
          args: [
            extra.id,
            input.caseId,
            JSON.stringify(extra.binding),
            extra.body,
            extra.status,
            extraOperation,
            extraFingerprint,
            input.turnId,
            priorOutcome.rows[0]?.run_id
              ? String(priorOutcome.rows[0].run_id)
              : null,
            typeof existingOutcome?.telemetry?.traceId === "string"
              ? existingOutcome.telemetry.traceId
              : null,
            typeof existingOutcome?.telemetry?.traceId === "string"
              ? "known"
              : "unknown",
            now(),
            now(),
          ],
        });
      }
      await tx.commit();
      return updated;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

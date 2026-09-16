import type { Client } from "@libsql/client";
import type { CaseFeedback, CaseMessage } from "../domain/support-case";
import {
  now,
  parse,
  dispatchLeaseUntil,
  DispatchRecord,
  FeedbackRecord,
  SupportTurnRecord,
  SupervisorExecutionRecord,
} from "./case-store-shared";

export class CaseStoreTurns {
  constructor(private readonly client: Client) {}
  async turns(caseId: string): Promise<SupportTurnRecord[]> {
    const rows = await this.client.execute({
      sql: "SELECT id, event_id, sequence, state, run_id, command_fingerprint, message_data, outcome_data FROM support_turns WHERE case_id = ? ORDER BY sequence",
      args: [caseId],
    });
    return rows.rows.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      sequence: Number(row.sequence),
      state: String(row.state),
      runId: row.run_id ? String(row.run_id) : undefined,
      commandFingerprint: row.command_fingerprint
        ? String(row.command_fingerprint)
        : undefined,
      message: row.message_data
        ? (JSON.parse(String(row.message_data)) as CaseMessage)
        : undefined,
      outcome: row.outcome_data
        ? (JSON.parse(String(row.outcome_data)) as Record<string, unknown>)
        : undefined,
    }));
  }
  async turn(
    caseId: string,
    turnId: string,
  ): Promise<SupportTurnRecord | undefined> {
    return (await this.turns(caseId)).find((turn) => turn.id === turnId);
  }
  /**
   * Called only after the route has authenticated the actor and read the
   * authoritative case binding.  Do not accept model-authored metadata here.
   */
  async recordSupervisorExecution(
    execution: Omit<SupervisorExecutionRecord, "id" | "createdAt">,
  ) {
    await this.client.execute({
      sql: "INSERT INTO support_supervisor_executions(id, tenant_id, case_id, thread_id, actor_id, run_id, trace_id, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        `supervisor_execution_${crypto.randomUUID()}`,
        execution.tenantId,
        execution.caseId,
        execution.threadId,
        execution.actorId,
        execution.runId,
        execution.traceId ?? null,
        execution.state,
        now(),
      ],
    });
  }
  /**
   * Monitoring joins the stored association to the durable case scope.  The
   * association's tenant field is therefore a second consistency check, never
   * authority by itself.
   */
  async supervisorExecutionsForMonitoring(tenantId: string, caseIds: string[]) {
    if (!caseIds.length) return [] as SupervisorExecutionRecord[];
    const rows = await this.client.execute({
      sql: `SELECT e.id, e.tenant_id, e.case_id, e.thread_id, e.actor_id, e.run_id, e.trace_id, e.state, e.created_at
        FROM support_supervisor_executions e
        JOIN support_cases c ON c.id = e.case_id
        WHERE e.tenant_id = ? AND c.tenant_id = ? AND e.case_id IN (${caseIds.map(() => "?").join(", ")})
        ORDER BY e.created_at`,
      args: [tenantId, tenantId, ...caseIds],
    });
    return rows.rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      caseId: String(row.case_id),
      threadId: String(row.thread_id),
      actorId: String(row.actor_id),
      runId: String(row.run_id),
      traceId: row.trace_id ? String(row.trace_id) : undefined,
      state: String(row.state) as SupervisorExecutionRecord["state"],
      createdAt: String(row.created_at),
    }));
  }
  private async insertLegacyFeedback(
    tx: Pick<Client, "execute">,
    caseId: string,
    feedback: CaseFeedback,
  ) {
    const turn =
      typeof feedback.turnId === "string"
        ? await tx.execute({
            sql: "SELECT id FROM support_turns WHERE id = ? AND case_id = ?",
            args: [feedback.turnId, caseId],
          })
        : undefined;
    const knownTurn = turn?.rows[0] ? String(turn.rows[0].id) : undefined;
    const knownActor =
      typeof feedback.actorId === "string" && feedback.actorId.length > 0
        ? feedback.actorId
        : undefined;
    const knownTime =
      typeof feedback.submittedAt === "string" &&
      Number.isFinite(Date.parse(feedback.submittedAt));
    const attributionState =
      knownTurn && knownActor && knownTime ? "known" : "legacy-unknown";
    const turnId = knownTurn ?? `legacy:unknown:${caseId}`;
    const actorId = knownActor ?? "legacy:unknown";
    const existing = await tx.execute({
      sql: "SELECT id FROM support_feedback WHERE case_id = ? AND turn_id = ? AND actor_id = ? AND dedupe_key = ?",
      args: [caseId, turnId, actorId, feedback.rating],
    });
    if (existing.rows[0]) return;
    await tx.execute({
      sql: "INSERT INTO support_feedback(id, case_id, turn_id, actor_id, data, created_at, dedupe_key, attribution_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        `feedback_legacy_${crypto.randomUUID()}`,
        caseId,
        turnId,
        actorId,
        JSON.stringify(feedback),
        knownTime ? feedback.submittedAt : null,
        feedback.rating,
        attributionState,
      ],
    });
  }
  async recordFeedback(input: {
    caseId: string;
    turnId: string;
    actorId: string;
    feedback: CaseFeedback;
  }): Promise<CaseFeedback> {
    const tx = await this.client.transaction("write");
    try {
      const turn = await tx.execute({
        sql: "SELECT state, run_id, outcome_data FROM support_turns WHERE id = ? AND case_id = ?",
        args: [input.turnId, input.caseId],
      });
      const row = turn.rows[0] as Record<string, unknown> | undefined;
      const outcome = row?.outcome_data
        ? (JSON.parse(String(row.outcome_data)) as {
            status?: unknown;
            finalResponse?: unknown;
            telemetry?: { traceId?: unknown };
          })
        : undefined;
      // Dispatch completion is a separate lifecycle. A finalized immutable
      // response remains rateable even though its dispatch is "completed".
      if (
        !row ||
        !["resolved", "escalated"].includes(String(outcome?.status)) ||
        typeof outcome?.finalResponse !== "string"
      )
        throw new Error("Feedback must target a completed response turn.");
      const telemetry = outcome?.telemetry;
      if (
        input.feedback.runId !==
          (row.run_id ? String(row.run_id) : undefined) ||
        input.feedback.traceId !==
          (typeof telemetry?.traceId === "string"
            ? telemetry.traceId
            : undefined)
      )
        throw new Error(
          "Feedback correlation does not match the response turn.",
        );
      const supportCase = await tx.execute({
        sql: "SELECT data FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const legacy = supportCase.rows[0]
        ? parse(supportCase.rows[0] as Record<string, unknown>).feedback
        : undefined;
      // A projection can predate the feedback table or point to an earlier
      // turn. Preserve it before the route replaces the active projection.
      if (legacy) await this.insertLegacyFeedback(tx, input.caseId, legacy);
      const existing = await tx.execute({
        sql: "SELECT data FROM support_feedback WHERE case_id = ? AND turn_id = ? AND actor_id = ? AND dedupe_key = ?",
        args: [
          input.caseId,
          input.turnId,
          input.actorId,
          input.feedback.rating,
        ],
      });
      if (existing.rows[0]) {
        await tx.commit();
        return JSON.parse(String(existing.rows[0].data)) as CaseFeedback;
      }
      await tx.execute({
        sql: "INSERT INTO support_feedback(id, case_id, turn_id, actor_id, data, created_at, dedupe_key, attribution_state) VALUES (?, ?, ?, ?, ?, ?, ?, 'known')",
        args: [
          `feedback_${crypto.randomUUID()}`,
          input.caseId,
          input.turnId,
          input.actorId,
          JSON.stringify(input.feedback),
          input.feedback.submittedAt,
          input.feedback.rating,
        ],
      });
      await tx.commit();
      return input.feedback;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  async feedback(caseIds: string[]): Promise<FeedbackRecord[]> {
    if (!caseIds.length) return [];
    const rows = await this.client.execute({
      sql: `SELECT id, case_id, data, attribution_state FROM support_feedback WHERE case_id IN (${caseIds.map(() => "?").join(", ")}) ORDER BY created_at DESC`,
      args: caseIds,
    });
    return rows.rows.map((row) => ({
      id: String(row.id),
      caseId: String(row.case_id),
      feedback: JSON.parse(String(row.data)) as CaseFeedback,
      attributionState:
        String(row.attribution_state) === "legacy-unknown"
          ? "legacy-unknown"
          : "known",
    }));
  }
  /** Immutable turn correlation survives later follow-up projections. */
  async recordTurnTelemetry(
    caseId: string,
    turnId: string,
    telemetry: { traceId?: string; workflowRunId?: string },
  ) {
    const current = await this.turn(caseId, turnId);
    if (!current) throw new Error("Turn is missing for telemetry correlation.");
    await this.client.execute({
      sql: "UPDATE support_turns SET outcome_data = ?, updated_at = ? WHERE id = ? AND case_id = ?",
      args: [
        JSON.stringify({ ...current.outcome, telemetry }),
        now(),
        turnId,
        caseId,
      ],
    });
  }
  async bindTurnCommand(caseId: string, turnId: string, fingerprint: string) {
    const changed = await this.client.execute({
      sql: "UPDATE support_turns SET command_fingerprint = ?, updated_at = ? WHERE id = ? AND case_id = ? AND (command_fingerprint IS NULL OR command_fingerprint = ?)",
      args: [fingerprint, now(), turnId, caseId, fingerprint],
    });
    if (Number(changed.rowsAffected) !== 1)
      throw new Error("Turn command is missing, already bound, or changed.");
  }
  /** Acquire the same durable lease used by recovery before a normal ingest starts. */
  async claimDispatchForStart(
    caseId: string,
    runId?: string,
  ): Promise<DispatchRecord | undefined> {
    const claimedAt = now();
    const leaseUntil = dispatchLeaseUntil();
    const row = await this.client.execute({
      sql: "SELECT candidate.* FROM support_dispatch AS candidate JOIN support_turns AS candidate_turn ON candidate_turn.id = candidate.turn_id WHERE candidate.case_id = ? AND candidate.state = 'pending' AND (? IS NULL OR candidate.run_id = ?) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS active WHERE active.case_id = candidate.case_id AND active.id <> candidate.id AND active.state IN ('claimed', 'started', 'suspended')) ORDER BY candidate_turn.sequence LIMIT 1",
      args: [caseId, runId ?? null, runId ?? null],
    });
    if (!row.rows[0]) return undefined;
    const leaseToken = crypto.randomUUID();
    const update = await this.client.execute({
      sql: "UPDATE support_dispatch AS candidate SET state = 'claimed', attempts = attempts + 1, lease_until = ?, lease_token = ?, updated_at = ? WHERE id = ? AND state = 'pending' AND NOT EXISTS (SELECT 1 FROM support_dispatch AS active WHERE active.case_id = candidate.case_id AND active.id <> candidate.id AND active.state IN ('claimed', 'started', 'suspended')) AND NOT EXISTS (SELECT 1 FROM support_dispatch AS earlier JOIN support_turns AS earlier_turn ON earlier_turn.id = earlier.turn_id JOIN support_turns AS candidate_turn ON candidate_turn.id = candidate.turn_id WHERE earlier.case_id = candidate.case_id AND earlier.state = 'pending' AND earlier_turn.sequence < candidate_turn.sequence)",
      args: [leaseUntil, leaseToken, claimedAt, String(row.rows[0].id)],
    });
    if (Number(update.rowsAffected) !== 1) return undefined;
    const current = row.rows[0] as Record<string, unknown>;
    return {
      id: String(current.id),
      caseId,
      turnId: String(current.turn_id),
      runId: String(current.run_id),
      state: "claimed",
      attempts: Number(current.attempts) + 1,
      wasStarted: false,
      leaseToken,
    };
  }
  /** Approval resume reacquires the dispatch lease so recovery and an API call
   * cannot both advance the suspended workflow. */
  async claimDispatchForResume(
    caseId: string,
    runId?: string,
    turnId?: string,
  ): Promise<DispatchRecord | undefined> {
    const claimedAt = now();
    const leaseToken = crypto.randomUUID();
    const row = await this.client.execute({
      sql: "SELECT * FROM support_dispatch d WHERE d.case_id = ? AND (d.state = 'suspended' OR (d.state = 'claimed' AND d.lease_until < ?)) AND (? IS NULL OR d.turn_id = ?) AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = d.id AND r.reconcile_lease_until > ?) ORDER BY d.created_at LIMIT 1",
      args: [caseId, claimedAt, turnId ?? null, turnId ?? null, claimedAt],
    });
    if (!row.rows[0]) {
      // Phase 001 and direct Studio workflow runs may have a durable case/run
      // but predate the dispatch table.  The caller has already verified a
      // waiting case and run id; backfill a suspended intent before claiming.
      if (!runId) return undefined;
      try {
        await this.client.execute({
          sql: "INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, 'suspended', 0, ?, ?)",
          args: [
            `dispatch_resume_${caseId}`,
            caseId,
            turnId ?? `legacy:${caseId}`,
            runId,
            claimedAt,
            claimedAt,
          ],
        });
      } catch (error) {
        if (!String(error).includes("UNIQUE")) throw error;
      }
      // A raced worker may have created or advanced the row.  Do one bounded
      // reread rather than recursively trying to insert forever.
      const backfilled = await this.client.execute({
        sql: "SELECT * FROM support_dispatch d WHERE d.case_id = ? AND d.state = 'suspended' AND (? IS NULL OR d.turn_id = ?) AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = d.id AND r.reconcile_lease_until > ?) ORDER BY d.created_at LIMIT 1",
        args: [caseId, turnId ?? null, turnId ?? null, claimedAt],
      });
      if (!backfilled.rows[0]) return undefined;
      const update = await this.client.execute({
        sql: "UPDATE support_dispatch SET state = 'claimed', lease_until = ?, lease_token = ?, updated_at = ? WHERE id = ? AND case_id = ? AND turn_id = ? AND (state = 'suspended' OR (state = 'claimed' AND lease_until < ?)) AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = support_dispatch.id AND r.reconcile_lease_until > ?)",
        args: [
          dispatchLeaseUntil(),
          leaseToken,
          claimedAt,
          String(backfilled.rows[0].id),
          caseId,
          turnId ?? `legacy:${caseId}`,
          claimedAt,
          claimedAt,
        ],
      });
      if (Number(update.rowsAffected) !== 1) return undefined;
      const current = backfilled.rows[0] as Record<string, unknown>;
      return {
        id: String(current.id),
        caseId,
        turnId: String(current.turn_id),
        runId: String(current.run_id),
        state: "claimed",
        attempts: Number(current.attempts),
        wasStarted: true,
        leaseToken,
      };
    }
    const update = await this.client.execute({
      sql: "UPDATE support_dispatch SET state = 'claimed', lease_until = ?, lease_token = ?, updated_at = ? WHERE id = ? AND case_id = ? AND turn_id = ? AND (state = 'suspended' OR (state = 'claimed' AND lease_until < ?)) AND NOT EXISTS (SELECT 1 FROM support_stripe_refund_attempts r WHERE r.dispatch_id = support_dispatch.id AND r.reconcile_lease_until > ?)",
      args: [
        dispatchLeaseUntil(),
        leaseToken,
        claimedAt,
        String(row.rows[0].id),
        caseId,
        turnId ?? String(row.rows[0].turn_id),
        claimedAt,
        claimedAt,
      ],
    });
    if (Number(update.rowsAffected) !== 1) return undefined;
    const current = row.rows[0] as Record<string, unknown>;
    return {
      id: String(current.id),
      caseId,
      turnId: String(current.turn_id),
      runId: String(current.run_id),
      state: "claimed",
      attempts: Number(current.attempts),
      wasStarted: true,
      leaseToken,
    };
  }
}

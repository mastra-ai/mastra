import { createHash, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import type { CaseMessage, SupportCase } from "../domain/support-case";
import { bindingsForCase } from "../providers/contracts";
import { now, parse, withBindings } from "./case-store-shared";
import { hasResolutionBlocker } from "./resolution-blockers";

export type ManualResolutionContext = {
  version: number;
  activeTurnId?: string;
  receipt?: {
    id: string;
    actorId: string;
    turnId: string;
    createdAt: string;
    noteState: string;
    closeState: string;
  };
};

function payloadHash(input: {
  caseId: string;
  actorId: string;
  expectedVersion: number;
  expectedTurnId: string;
  internalNote: string;
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/** The command is intentionally a dedicated transaction. Workflow finalization
 * owns a response turn; staff close preserves that immutable outcome and only
 * records an internal note followed by an ordered channel close. */
export class CaseStoreManualResolution {
  constructor(private readonly client: Client) {}

  async context(caseId: string): Promise<ManualResolutionContext | undefined> {
    const result = await this.client.execute({
      sql: "SELECT version, data FROM support_cases WHERE id = ?",
      args: [caseId],
    });
    const row = result.rows[0];
    if (!row) return undefined;
    const receipt = await this.client.execute({
      sql: `SELECT r.id, r.actor_id, r.turn_id, r.created_at,
        n.state AS note_state, c.state AS close_state
        FROM support_manual_resolutions r
        LEFT JOIN support_outbox n ON n.id = r.note_outbox_id
        LEFT JOIN support_outbox c ON c.id = r.close_outbox_id
        WHERE r.case_id = ? ORDER BY r.created_at DESC LIMIT 1`,
      args: [caseId],
    });
    const entry = receipt.rows[0] as Record<string, unknown> | undefined;
    const supportCase = parse(row as Record<string, unknown>);
    return {
      version: Number(row.version),
      activeTurnId: supportCase.metadata.activeTurnId,
      ...(entry
        ? {
            receipt: {
              id: String(entry.id),
              actorId: String(entry.actor_id),
              turnId: String(entry.turn_id),
              createdAt: String(entry.created_at),
              noteState: String(entry.note_state ?? "missing"),
              closeState: String(entry.close_state ?? "missing"),
            },
          }
        : {}),
    };
  }

  async resolve(input: {
    caseId: string;
    tenantId: string;
    actorId: string;
    expectedVersion: number;
    expectedTurnId: string;
    idempotencyKey: string;
    internalNote: string;
  }): Promise<
    | { state: "accepted" | "replayed"; context: ManualResolutionContext }
    | { state: "conflict"; reason: string }
  > {
    const hash = payloadHash(input);
    const tx = await this.client.transaction("write");
    try {
      // Replay comes first: a lost response must not be rejected merely because
      // a customer follow-up has since replaced the current projection.
      const existing = await tx.execute({
        sql: "SELECT * FROM support_manual_resolutions WHERE tenant_id = ? AND idempotency_key = ?",
        args: [input.tenantId, input.idempotencyKey],
      });
      if (existing.rows[0]) {
        const row = existing.rows[0] as Record<string, unknown>;
        if (
          String(row.case_id) !== input.caseId ||
          String(row.actor_id) !== input.actorId ||
          String(row.turn_id) !== input.expectedTurnId ||
          Number(row.expected_version) !== input.expectedVersion ||
          String(row.payload_hash) !== hash
        ) {
          await tx.rollback();
          return {
            state: "conflict",
            reason: "Idempotency key conflicts with an existing command.",
          };
        }
        await tx.rollback();
        return {
          state: "replayed",
          context: (await this.context(input.caseId))!,
        };
      }

      const read = await tx.execute({
        sql: "SELECT data, version, tenant_id FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = read.rows[0] as Record<string, unknown> | undefined;
      if (!row || String(row.tenant_id) !== input.tenantId) {
        await tx.rollback();
        return { state: "conflict", reason: "Case is unavailable." };
      }
      const supportCase = parse(row);
      const version = Number(row.version);
      if (
        supportCase.status !== "escalated" ||
        supportCase.metadata.retentionRedactedAt ||
        version !== input.expectedVersion ||
        supportCase.metadata.activeTurnId !== input.expectedTurnId
      ) {
        await tx.rollback();
        return {
          state: "conflict",
          reason: "Case changed; refresh before resolving.",
        };
      }
      const activeTurn = await tx.execute({
        sql: "SELECT state FROM support_turns WHERE id = ? AND case_id = ?",
        args: [input.expectedTurnId, input.caseId],
      });
      if (
        !activeTurn.rows[0] ||
        !["resolved", "escalated"].includes(String(activeTurn.rows[0].state))
      ) {
        await tx.rollback();
        return {
          state: "conflict",
          reason: "The selected turn is not committed.",
        };
      }
      if (await hasResolutionBlocker(tx, input.caseId, supportCase)) {
        await tx.rollback();
        return {
          state: "conflict",
          reason:
            "An active workflow or financial operation blocks manual resolution.",
        };
      }
      const timestamp = now();
      const commandId = `manual_${randomUUID()}`;
      const message: CaseMessage = {
        id: `${commandId}_message`,
        author: "internal",
        authorName: "Support team",
        body: input.internalNote,
        createdAt: timestamp,
      };
      const bindings = bindingsForCase(supportCase);
      const noteId = `${commandId}_01_note`;
      const closeId = `${commandId}_02_close`;
      const updated: SupportCase = withBindings({
        ...supportCase,
        status: "resolved",
        messages: [...supportCase.messages, message],
        updatedAt: timestamp,
      });
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [JSON.stringify(updated), timestamp, input.caseId, version],
      });
      if (Number(write.rowsAffected) !== 1) {
        await tx.rollback();
        return {
          state: "conflict",
          reason: "Case changed; refresh before resolving.",
        };
      }
      await tx.execute({
        sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
        args: [message.id, input.caseId, JSON.stringify(message), timestamp],
      });
      await tx.execute({
        sql: "INSERT INTO support_manual_resolutions(id, case_id, tenant_id, actor_id, turn_id, expected_version, idempotency_key, payload_hash, note_message_id, note_outbox_id, close_outbox_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          commandId,
          input.caseId,
          input.tenantId,
          input.actorId,
          input.expectedTurnId,
          input.expectedVersion,
          input.idempotencyKey,
          hash,
          message.id,
          noteId,
          closeId,
          timestamp,
        ],
      });
      await tx.execute({
        sql: "INSERT INTO support_audit(id, case_id, kind, actor_id, data, created_at) VALUES (?, ?, 'manual_resolution', ?, ?, ?)",
        args: [
          `audit_${commandId}`,
          input.caseId,
          input.actorId,
          JSON.stringify({
            turnId: input.expectedTurnId,
            noteMessageId: message.id,
          }),
          timestamp,
        ],
      });
      for (const row of [
        {
          id: noteId,
          operation: "note",
          body: input.internalNote,
          status: "resolved",
        },
        { id: closeId, operation: "status", body: "", status: "resolved" },
      ]) {
        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify({
              binding: bindings.support,
              operation: row.operation,
              body: row.body,
              status: row.status,
            }),
          )
          .digest("hex");
        await tx.execute({
          sql: "INSERT INTO support_outbox(id, case_id, binding, body, status, operation, payload_fingerprint, state, attempts, created_at, updated_at, originating_turn_id, correlation_state) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, 'known')",
          args: [
            row.id,
            input.caseId,
            JSON.stringify(bindings.support),
            row.body,
            row.status,
            row.operation,
            fingerprint,
            timestamp,
            timestamp,
            input.expectedTurnId,
          ],
        });
      }
      await tx.commit();
      return {
        state: "accepted",
        context: {
          version: version + 1,
          activeTurnId: input.expectedTurnId,
          receipt: {
            id: commandId,
            actorId: input.actorId,
            turnId: input.expectedTurnId,
            createdAt: timestamp,
            noteState: "pending",
            closeState: "pending",
          },
        },
      };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

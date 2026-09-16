import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import type { CaseMessage, SupportCase } from "../domain/support-case";
import { bindingsForCase } from "../providers/contracts";
import { now, parse, withBindings } from "./case-store-shared";
import { hasResolutionBlocker } from "./resolution-blockers";

export type IntercomCloseIntent = {
  id: string;
  tenantId: string;
  providerAccountId: string;
  eventId: string;
  externalConversationId: string;
  attempts: number;
  leaseToken: string;
};

/** A webhook is only a signed hint. This store records that hint, and the
 * worker later re-reads the exact provider conversation before applying a CAS. */
export class CaseStoreIntercomClose {
  constructor(private readonly client: Client) {}

  async record(input: {
    tenantId: string;
    providerAccountId: string;
    eventId: string;
    externalConversationId: string;
  }) {
    const timestamp = now();
    const id = `intercom_close_${randomUUID()}`;
    const result = await this.client.execute({
      sql: "INSERT INTO support_intercom_close_intents(id, tenant_id, provider_account_id, event_id, external_conversation_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(tenant_id, provider_account_id, event_id) DO NOTHING",
      args: [
        id,
        input.tenantId,
        input.providerAccountId,
        input.eventId,
        input.externalConversationId,
        timestamp,
        timestamp,
      ],
    });
    return { accepted: Number(result.rowsAffected) === 1 };
  }

  async claim(limit = 10): Promise<IntercomCloseIntent[]> {
    const timestamp = now();
    const rows = await this.client.execute({
      sql: "SELECT * FROM support_intercom_close_intents WHERE state IN ('pending','deferred') OR (state = 'claimed' AND lease_until < ?) ORDER BY created_at LIMIT ?",
      args: [timestamp, limit],
    });
    const claimed: IntercomCloseIntent[] = [];
    for (const row of rows.rows) {
      const value = row as Record<string, unknown>;
      const leaseToken = randomUUID();
      const changed = await this.client.execute({
        sql: "UPDATE support_intercom_close_intents SET state = 'claimed', attempts = attempts + 1, lease_token = ?, lease_until = ?, updated_at = ? WHERE id = ? AND (state IN ('pending','deferred') OR (state = 'claimed' AND lease_until < ?))",
        args: [
          leaseToken,
          new Date(Date.now() + 30_000).toISOString(),
          timestamp,
          String(value.id),
          timestamp,
        ],
      });
      if (Number(changed.rowsAffected) === 1)
        claimed.push({
          id: String(value.id),
          tenantId: String(value.tenant_id),
          providerAccountId: String(value.provider_account_id),
          eventId: String(value.event_id),
          externalConversationId: String(value.external_conversation_id),
          attempts: Number(value.attempts) + 1,
          leaseToken,
        });
    }
    return claimed;
  }

  async defer(id: string, leaseToken: string, error: string) {
    const changed = await this.client.execute({
      sql: "UPDATE support_intercom_close_intents SET state = 'deferred', lease_token = NULL, lease_until = NULL, last_error = ?, updated_at = ? WHERE id = ? AND state = 'claimed' AND lease_token = ?",
      args: [error, now(), id, leaseToken],
    });
    return Number(changed.rowsAffected) === 1;
  }

  async complete(
    id: string,
    leaseToken: string,
    state: "applied" | "superseded",
  ) {
    const changed = await this.client.execute({
      sql: "UPDATE support_intercom_close_intents SET state = ?, lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND state = 'claimed' AND lease_token = ?",
      args: [state, now(), id, leaseToken],
    });
    return Number(changed.rowsAffected) === 1;
  }

  async apply(input: {
    intentId: string;
    leaseToken: string;
    tenantId: string;
    providerAccountId: string;
    externalConversationId: string;
    expectedVersion: number;
  }): Promise<"applied" | "superseded" | "deferred" | "retry"> {
    const tx = await this.client.transaction("write");
    try {
      const owner = await tx.execute({
        sql: "SELECT case_id FROM support_conversations WHERE tenant_id = ? AND provider_kind = 'intercom' AND provider_account_id = ? AND external_conversation_id = ?",
        args: [
          input.tenantId,
          input.providerAccountId,
          input.externalConversationId,
        ],
      });
      const caseId = owner.rows[0] ? String(owner.rows[0].case_id) : undefined;
      if (!caseId) {
        await tx.rollback();
        await this.complete(input.intentId, input.leaseToken, "superseded");
        return "superseded";
      }
      const read = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [caseId],
      });
      const row = read.rows[0] as Record<string, unknown> | undefined;
      if (!row || Number(row.version) !== input.expectedVersion) {
        await tx.rollback();
        return "retry";
      }
      const supportCase = parse(row);
      if (supportCase.metadata.retentionRedactedAt) {
        await tx.rollback();
        await this.complete(input.intentId, input.leaseToken, "superseded");
        return "superseded";
      }
      const binding = bindingsForCase(supportCase).support;
      if (
        binding.providerKind !== "intercom" ||
        binding.tenantId !== input.tenantId ||
        binding.providerAccountId !== input.providerAccountId ||
        binding.externalConversationId !== input.externalConversationId
      ) {
        await tx.rollback();
        await this.complete(input.intentId, input.leaseToken, "superseded");
        return "superseded";
      }
      if (await hasResolutionBlocker(tx, caseId, supportCase)) {
        await tx.rollback();
        await this.defer(
          input.intentId,
          input.leaseToken,
          "A workflow or financial operation is still active.",
        );
        return "deferred";
      }
      // The app's own durable manual-close command already made this projection
      // converge. Do not add a marker or create an outbound loop.
      const manual = await tx.execute({
        sql: "SELECT id FROM support_manual_resolutions WHERE case_id = ? LIMIT 1",
        args: [caseId],
      });
      if (supportCase.status === "resolved" && manual.rows[0]) {
        await tx.rollback();
        await this.complete(input.intentId, input.leaseToken, "applied");
        return "applied";
      }
      const timestamp = now();
      const message: CaseMessage = {
        id: `provider_close_${input.intentId}`,
        author: "internal",
        authorName: "Intercom",
        body: "Conversation was closed by an authenticated Intercom administrator.",
        createdAt: timestamp,
      };
      const updated: SupportCase = withBindings({
        ...supportCase,
        status: "resolved",
        messages: [...supportCase.messages, message],
        updatedAt: timestamp,
      });
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [
          JSON.stringify(updated),
          timestamp,
          caseId,
          input.expectedVersion,
        ],
      });
      if (Number(write.rowsAffected) !== 1) {
        await tx.rollback();
        return "retry";
      }
      await tx.execute({
        sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
        args: [message.id, caseId, JSON.stringify(message), timestamp],
      });
      await tx.execute({
        sql: "INSERT INTO support_audit(id, case_id, kind, actor_id, data, created_at) VALUES (?, ?, 'intercom_admin_close', NULL, ?, ?)",
        args: [
          `audit_${input.intentId}`,
          caseId,
          JSON.stringify({
            providerAccountId: input.providerAccountId,
            eventId: input.intentId,
          }),
          timestamp,
        ],
      });
      const intent = await tx.execute({
        sql: "UPDATE support_intercom_close_intents SET state = 'applied', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND state = 'claimed' AND lease_token = ?",
        args: [timestamp, input.intentId, input.leaseToken],
      });
      if (Number(intent.rowsAffected) !== 1) {
        await tx.rollback();
        return "retry";
      }
      await tx.commit();
      return "applied";
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

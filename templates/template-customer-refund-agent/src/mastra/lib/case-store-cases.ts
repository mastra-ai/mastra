import type { Client } from "@libsql/client";
import type { CaseMessage, SupportCase } from "../domain/support-case";
import type { ProviderBinding } from "../providers/contracts";
import { activeDispatchLeaseScope } from "./dispatch-lease-scope";
import {
  now,
  parse,
  scopedEventId,
  scopedMessageId,
  isRetentionTombstone,
  caseBinding,
  withBindings,
  assertBindingsUnchanged,
  StaleCaseWriteError,
} from "./case-store-shared";

/** The conversation owner is accepted once from authenticated ingress and is
 * retained separately from mutable case presentation data. Financial paths
 * must resolve this binding, rather than reconstructing identity from email. */
export async function canonicalConversationOwner(
  client: Pick<Client, "execute">,
  input: { caseId: string; binding: ProviderBinding },
) {
  const result = await client.execute({
    sql: "SELECT owner_id FROM support_conversations WHERE tenant_id = ? AND provider_kind = ? AND provider_account_id = ? AND external_conversation_id = ? AND case_id = ?",
    args: [
      input.binding.tenantId,
      input.binding.providerKind,
      input.binding.providerAccountId,
      input.binding.externalConversationId,
      input.caseId,
    ],
  });
  const ownerId = result.rows[0]?.owner_id;
  return typeof ownerId === "string" && ownerId.length > 0
    ? ownerId
    : undefined;
}

export class CaseStoreCases {
  constructor(private readonly client: Client) {}
  async findByExternalId(source: string, externalId: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM support_cases WHERE source = ? AND external_id = ?",
      args: [source, externalId],
    });
    return result.rows[0]
      ? parse(result.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async get(id: string) {
    const result = await this.client.execute({
      sql: "SELECT data FROM support_cases WHERE id = ?",
      args: [id],
    });
    return result.rows[0]
      ? parse(result.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async list() {
    const result = await this.client.execute(
      "SELECT data FROM support_cases ORDER BY created_at DESC",
    );
    return result.rows.map((row) => parse(row as Record<string, unknown>));
  }
  async findConversation(
    tenantId: string,
    externalConversationId: string,
    providerKind = "local",
    providerAccountId = "local-demo",
  ): Promise<SupportCase | undefined> {
    const result = await this.client.execute({
      sql: "SELECT c.data FROM support_conversations x JOIN support_cases c ON c.id = x.case_id WHERE x.tenant_id = ? AND x.provider_kind = ? AND x.provider_account_id = ? AND x.external_conversation_id = ?",
      args: [tenantId, providerKind, providerAccountId, externalConversationId],
    });
    return result.rows[0]
      ? parse(result.rows[0] as Record<string, unknown>)
      : undefined;
  }
  async conversationSnapshot(
    tenantId: string,
    externalConversationId: string,
    providerKind: string,
    providerAccountId: string,
  ): Promise<{ supportCase: SupportCase; version: number } | undefined> {
    const result = await this.client.execute({
      sql: "SELECT c.data, c.version FROM support_conversations x JOIN support_cases c ON c.id = x.case_id WHERE x.tenant_id = ? AND x.provider_kind = ? AND x.provider_account_id = ? AND x.external_conversation_id = ?",
      args: [tenantId, providerKind, providerAccountId, externalConversationId],
    });
    const row = result.rows[0];
    return row
      ? {
          supportCase: parse(row as Record<string, unknown>),
          version: Number(row.version),
        }
      : undefined;
  }
  async canonicalConversationOwner(input: {
    caseId: string;
    binding: ProviderBinding;
  }) {
    return canonicalConversationOwner(this.client, input);
  }
  async create(case_: SupportCase) {
    const persisted = withBindings(case_);
    const binding = caseBinding(persisted);
    const tx = await this.client.transaction("write");
    try {
      await tx.execute({
        sql: "INSERT INTO support_cases(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_account_id, provider_binding, accepted_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
        args: [
          persisted.id,
          persisted.source,
          persisted.externalId,
          JSON.stringify(persisted),
          persisted.createdAt,
          persisted.updatedAt,
          binding.tenantId,
          binding.providerAccountId,
          JSON.stringify(binding),
          persisted.createdAt,
        ],
      });
      const ownerId = persisted.metadata.ownerId;
      if (typeof ownerId === "string" && ownerId.length > 0)
        await tx.execute({
          sql: "INSERT INTO support_conversations(tenant_id, provider_kind, provider_account_id, external_conversation_id, case_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            binding.externalConversationId,
            persisted.id,
            ownerId,
          ],
        });
      for (const message of persisted.messages)
        await tx.execute({
          sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
          args: [
            message.id,
            persisted.id,
            JSON.stringify(message),
            message.createdAt,
          ],
        });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
    return persisted;
  }
  async update(
    id: string,
    patch: Partial<SupportCase>,
    expectedVersion?: number,
  ) {
    const tx = await this.client.transaction("write");
    try {
      const result = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [id],
      });
      const row = result.rows[0];
      if (!row) throw new Error(`Support case not found: ${id}`);
      const lease = activeDispatchLeaseScope();
      if (lease) {
        if (lease.caseId !== id)
          throw new Error(
            "Workflow dispatch scope cannot project another case.",
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
            `Dispatch lease is no longer current for ${id}.`,
          );
      }
      const version = Number(row.version ?? 1);
      if (expectedVersion !== undefined && expectedVersion !== version)
        throw new StaleCaseWriteError(id);
      const current = parse(row as Record<string, unknown>);
      if (isRetentionTombstone(current))
        throw new Error("Expired support case is a retention tombstone.");
      const updated = withBindings({
        ...current,
        ...patch,
        updatedAt: now(),
      } as SupportCase);
      assertBindingsUnchanged(current, updated);
      const write = await tx.execute({
        sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
        args: [JSON.stringify(updated), updated.updatedAt, id, version],
      });
      if (Number(write.rowsAffected) !== 1) throw new StaleCaseWriteError(id);
      if (patch.messages)
        for (const message of patch.messages)
          await tx.execute({
            sql: "INSERT OR IGNORE INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
            args: [message.id, id, JSON.stringify(message), message.createdAt],
          });
      await tx.commit();
      return updated;
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Version is a fence for projections which must not overwrite a provider
   * finalizer that races after an external-effect receipt. */
  async version(id: string) {
    const row = await this.client.execute({
      sql: "SELECT version FROM support_cases WHERE id = ?",
      args: [id],
    });
    if (!row.rows[0]) throw new Error(`Support case not found: ${id}`);
    return Number(row.rows[0].version ?? 1);
  }
  async appendMessage(id: string, message: CaseMessage) {
    // Retry the short CAS update so two inbound follow-ups cannot overwrite one another.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const tx = await this.client.transaction("write");
      try {
        const read = await tx.execute({
          sql: "SELECT data, version FROM support_cases WHERE id = ?",
          args: [id],
        });
        const row = read.rows[0];
        if (!row) throw new Error(`Support case not found: ${id}`);
        const current = parse(row as Record<string, unknown>);
        if (isRetentionTombstone(current))
          throw new Error("Expired support case is a retention tombstone.");
        if (current.messages.some((entry) => entry.id === message.id)) {
          await tx.rollback();
          return current;
        }
        const updated = {
          ...current,
          messages: [...current.messages, message],
          updatedAt: now(),
        };
        const write = await tx.execute({
          sql: "UPDATE support_cases SET data = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?",
          args: [
            JSON.stringify(updated),
            updated.updatedAt,
            id,
            Number(row.version ?? 1),
          ],
        });
        if (Number(write.rowsAffected) === 1) {
          await tx.execute({
            sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
            args: [message.id, id, JSON.stringify(message), message.createdAt],
          });
          await tx.commit();
          return updated;
        }
        await tx.rollback();
      } catch (error) {
        try {
          await tx.rollback();
        } catch {}
        throw error;
      }
    }
    throw new StaleCaseWriteError(id);
  }
  /** Append a follow-up to the canonical conversation.  A unique inbound
   * event gets one ordered turn; a duplicate returns false without changing
   * messages, approvals or dispatch state. */
  async appendFollowUp(input: {
    caseId: string;
    eventId: string;
    message: CaseMessage;
    runId: string;
    /** Set only by authenticated ingress after owner verification. */
    expectedOwnerId?: string;
  }): Promise<{
    appended: boolean;
    supportCase: SupportCase;
    turnId?: string;
  }> {
    const tx = await this.client.transaction("write");
    try {
      const read = await tx.execute({
        sql: "SELECT data, version FROM support_cases WHERE id = ?",
        args: [input.caseId],
      });
      const row = read.rows[0];
      if (!row) throw new Error(`Support case not found: ${input.caseId}`);
      const current = parse(row as Record<string, unknown>);
      if (isRetentionTombstone(current))
        throw new Error("Expired support case is a retention tombstone.");
      if (input.expectedOwnerId) {
        const binding = caseBinding(current);
        const canonical = await tx.execute({
          sql: "SELECT owner_id FROM support_conversations WHERE tenant_id = ? AND provider_kind = ? AND provider_account_id = ? AND external_conversation_id = ? AND case_id = ?",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            binding.externalConversationId,
            input.caseId,
          ],
        });
        if (
          !canonical.rows[0] ||
          String(canonical.rows[0].owner_id) !== input.expectedOwnerId
        )
          throw new Error(
            "Inbound conversation is owned by another principal.",
          );
      }
      const seen = await tx.execute({
        sql: "SELECT id FROM support_turns WHERE case_id = ? AND event_id = ?",
        args: [input.caseId, input.eventId],
      });
      if (seen.rows[0]) {
        await tx.rollback();
        return { appended: false, supportCase: current };
      }
      const activeTurnId = current.metadata.activeTurnId;
      if (typeof activeTurnId === "string") {
        // This is the other half of the manual provider-effect fence. Rows
        // still waiting for a POST are safely superseded. A row that has
        // already crossed its durable start marker may have reached Intercom,
        // so retain explicit uncertainty for the outbox worker to reconcile.
        await tx.execute({
          sql: "UPDATE support_outbox SET state = CASE WHEN state = 'started' THEN 'uncertain' ELSE 'superseded' END, receipt = CASE WHEN state = 'started' THEN NULL ELSE ? END, last_error = ?, lease_until = NULL, lease_token = NULL, updated_at = ? WHERE case_id = ? AND id LIKE 'manual_%' AND originating_turn_id = ? AND state IN ('pending', 'claimed', 'started')",
          args: [
            JSON.stringify({
              superseded: true,
              reason:
                "A newer customer turn superseded this manual resolution.",
            }),
            "A newer customer turn superseded this manual resolution.",
            now(),
            input.caseId,
            activeTurnId,
          ],
        });
      }
      const next = await tx.execute({
        sql: "SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM support_turns WHERE case_id = ?",
        args: [input.caseId],
      });
      const sequence = Number(next.rows[0]?.value ?? 1);
      const turnId = `turn_${crypto.randomUUID()}`;
      const invalidatesApproval = current.status === "waiting_approval";
      const terminal =
        current.status === "resolved" || current.status === "escalated";
      if (
        (invalidatesApproval || terminal) &&
        typeof activeTurnId === "string"
      ) {
        await tx.execute({
          // Telemetry can be recorded before a turn is terminal. Merge the
          // immutable projection into that object in this same transaction;
          // COALESCE used to discard the draft/approval snapshot here.
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
            activeTurnId,
            input.caseId,
          ],
        });
      }
      const resetProjection = invalidatesApproval || terminal;
      const updated: SupportCase = {
        ...current,
        messages: current.messages.some(
          (message) => message.id === input.message.id,
        )
          ? current.messages
          : [...current.messages, input.message],
        // A pending turn never takes ownership away from a running dispatch.
        // The scheduler activates it only after the prior turn is terminal.
        status: resetProjection ? "new" : current.status,
        triage: resetProjection ? undefined : current.triage,
        policyMatches: resetProjection ? undefined : current.policyMatches,
        orderLookup: resetProjection ? undefined : current.orderLookup,
        subscriptionLookup: resetProjection
          ? undefined
          : current.subscriptionLookup,
        refundHistory: resetProjection ? undefined : current.refundHistory,
        draft: resetProjection ? undefined : current.draft,
        approval: resetProjection ? undefined : current.approval,
        refundResult: resetProjection ? undefined : current.refundResult,
        subscriptionCreditResult: resetProjection
          ? undefined
          : current.subscriptionCreditResult,
        finalResponse: resetProjection ? undefined : current.finalResponse,
        escalationReason: resetProjection
          ? undefined
          : current.escalationReason,
        workflowRunId: resetProjection ? undefined : current.workflowRunId,
        traceId: resetProjection ? undefined : current.traceId,
        agentUsage: resetProjection ? undefined : current.agentUsage,
        updatedAt: now(),
        metadata: {
          ...current.metadata,
          pendingApprovalInvalidatedAt: invalidatesApproval
            ? now()
            : current.metadata.pendingApprovalInvalidatedAt,
          pendingTurnId: turnId,
          ...(resetProjection
            ? {
                activeTurnId: undefined,
                refundCommand: undefined,
                subscriptionCreditCommand: undefined,
                nativeApproval: undefined,
                refundEffects: undefined,
                subscriptionCreditEffects: undefined,
              }
            : {}),
        },
      };
      await tx.execute({
        sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id, message_data) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
        args: [
          turnId,
          input.caseId,
          input.eventId,
          sequence,
          now(),
          now(),
          input.runId,
          JSON.stringify(input.message),
        ],
      });
      const binding = caseBinding(current);
      await tx.execute({
        sql: "INSERT INTO support_events(id, tenant_id, provider_account_id, source, external_id, case_id, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          scopedEventId(binding, input.eventId),
          binding.tenantId,
          binding.providerAccountId,
          current.source,
          input.eventId,
          input.caseId,
          now(),
        ],
      });
      await tx.execute({
        sql: "INSERT OR IGNORE INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
        args: [
          scopedMessageId(input.caseId, input.message.id),
          input.caseId,
          JSON.stringify(input.message),
          input.message.createdAt,
        ],
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
      if (invalidatesApproval)
        await tx.execute({
          sql: "INSERT INTO support_audit(id, case_id, kind, data, created_at) VALUES (?, ?, 'approval-invalidated-follow-up', ?, ?)",
          args: [
            `audit_${crypto.randomUUID()}`,
            input.caseId,
            JSON.stringify({ eventId: input.eventId }),
            now(),
          ],
        });
      if (invalidatesApproval)
        await tx.execute({
          sql: "UPDATE support_dispatch SET state = 'completed', lease_until = NULL, lease_token = NULL, updated_at = ? WHERE case_id = ? AND state = 'suspended'",
          args: [now(), input.caseId],
        });
      await tx.execute({
        sql: "INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        args: [
          `dispatch_${turnId}`,
          input.caseId,
          turnId,
          input.runId,
          now(),
          now(),
        ],
      });
      await tx.commit();
      return { appended: true, supportCase: updated, turnId };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Atomic deduplication: event, case, messages and durable dispatch are committed together. */
  async acceptInbound(case_: SupportCase, eventId: string, runId: string) {
    const initialTurnId = `turn_${crypto.randomUUID()}`;
    const persisted = withBindings({
      ...case_,
      metadata: { ...case_.metadata, activeTurnId: initialTurnId },
    });
    const binding = caseBinding(persisted);
    const storageEventId = scopedEventId(binding, eventId);
    const storedOwner = persisted.metadata.ownerId;
    const ownerId =
      typeof storedOwner === "string" && storedOwner ? storedOwner : undefined;
    const tx = await this.client.transaction("write");
    try {
      const exists = await tx.execute({
        sql: "SELECT case_id FROM support_events WHERE tenant_id = ? AND provider_account_id = ? AND source = ? AND external_id = ?",
        args: [
          binding.tenantId,
          binding.providerAccountId,
          persisted.source,
          persisted.externalId,
        ],
      });
      if (exists.rows[0]) {
        if (ownerId) {
          const winner = await tx.execute({
            sql: "SELECT owner_id FROM support_conversations WHERE case_id = ?",
            args: [String(exists.rows[0].case_id)],
          });
          if (!winner.rows[0] || String(winner.rows[0].owner_id) !== ownerId)
            throw new Error(
              "Inbound conversation is owned by another principal.",
            );
        }
        await tx.rollback();
        return { caseId: String(exists.rows[0].case_id), isNew: false };
      }
      const canonical = ownerId
        ? await tx.execute({
            sql: "SELECT case_id, owner_id FROM support_conversations WHERE tenant_id = ? AND provider_kind = ? AND provider_account_id = ? AND external_conversation_id = ?",
            args: [
              binding.tenantId,
              binding.providerKind,
              binding.providerAccountId,
              binding.externalConversationId,
            ],
          })
        : { rows: [] };
      if (canonical.rows[0]) {
        const caseId = String(canonical.rows[0].case_id);
        if (String(canonical.rows[0].owner_id) !== ownerId)
          throw new Error(
            "Inbound conversation is owned by another principal.",
          );
        const existingCase = await tx.execute({
          sql: "SELECT data FROM support_cases WHERE id = ?",
          args: [caseId],
        });
        const existing = existingCase.rows[0]
          ? parse(existingCase.rows[0] as Record<string, unknown>)
          : undefined;
        if (!existing)
          throw new Error("Canonical conversation points to a missing case.");
        if (isRetentionTombstone(existing))
          throw new Error("Expired support case is a retention tombstone.");
        await tx.rollback();
        return { caseId, isNew: true, appendRequired: true };
      }
      // Phase 001 cases predate support_events.  Treat their scoped case
      // identity as the already-accepted event and backfill it in this same
      // transaction, so a replay cannot create a second dispatch.
      const legacy = await tx.execute({
        sql: "SELECT id FROM support_cases WHERE tenant_id = ? AND provider_account_id = ? AND source = ? AND external_id = ?",
        args: [
          binding.tenantId,
          binding.providerAccountId,
          persisted.source,
          persisted.externalId,
        ],
      });
      if (legacy.rows[0]) {
        const caseId = String(legacy.rows[0].id);
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_events(id, tenant_id, provider_account_id, source, external_id, case_id, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            storageEventId,
            binding.tenantId,
            binding.providerAccountId,
            persisted.source,
            persisted.externalId,
            caseId,
            now(),
          ],
        });
        await tx.commit();
        return { caseId, isNew: false };
      }
      await tx.execute({
        sql: "INSERT INTO support_cases(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_account_id, provider_binding, accepted_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
        args: [
          persisted.id,
          persisted.source,
          persisted.externalId,
          JSON.stringify(persisted),
          persisted.createdAt,
          persisted.updatedAt,
          binding.tenantId,
          binding.providerAccountId,
          JSON.stringify(binding),
          persisted.createdAt,
        ],
      });
      if (ownerId)
        await tx.execute({
          sql: "INSERT INTO support_conversations(tenant_id, provider_kind, provider_account_id, external_conversation_id, case_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            binding.externalConversationId,
            persisted.id,
            ownerId,
          ],
        });
      for (const message of persisted.messages)
        await tx.execute({
          sql: "INSERT INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
          args: [
            scopedMessageId(persisted.id, message.id),
            persisted.id,
            JSON.stringify(message),
            message.createdAt,
          ],
        });
      await tx.execute({
        sql: "INSERT INTO support_events(id, tenant_id, provider_account_id, source, external_id, case_id, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          storageEventId,
          binding.tenantId,
          binding.providerAccountId,
          persisted.source,
          persisted.externalId,
          persisted.id,
          now(),
        ],
      });
      const initialMessage = persisted.messages.at(-1);
      if (!initialMessage)
        throw new Error("Inbound support case requires a customer message.");
      await tx.execute({
        sql: "INSERT INTO support_turns(id, case_id, event_id, sequence, state, created_at, updated_at, run_id, message_data) VALUES (?, ?, ?, 1, 'pending', ?, ?, ?, ?)",
        args: [
          initialTurnId,
          persisted.id,
          eventId,
          now(),
          now(),
          runId,
          JSON.stringify(initialMessage),
        ],
      });
      await tx.execute({
        sql: "INSERT INTO support_dispatch(id, case_id, turn_id, run_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        args: [
          `dispatch_${storageEventId}`,
          persisted.id,
          initialTurnId,
          runId,
          now(),
          now(),
        ],
      });
      await tx.commit();
      return { caseId: persisted.id, isNew: true };
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
}

import type { Client } from "@libsql/client";
import {
  bindingsForCase,
  type ProviderBinding,
  type RefundCommand,
  type SubscriptionCreditCommand,
} from "../providers/contracts";
import { knowledgeAccountKey } from "./knowledge-publications";
import { refundPolicyEvidenceError } from "./refund-policy-evidence";

const text = (value: unknown) => String(value ?? "");
type Transaction = Awaited<ReturnType<Client["transaction"]>>;

type RefundPolicyEvidence = {
  title: string;
  source: string;
  documentHash: string;
  generationId: string;
  version: string;
  effectiveAt: string;
  indexedAt: string;
  expiresAt?: string;
  providerKind: string;
  providerAccountId: string;
};

function isRefundPolicyEvidence(value: unknown): value is RefundPolicyEvidence {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    [
      "title",
      "source",
      "documentHash",
      "generationId",
      "version",
      "effectiveAt",
      "indexedAt",
      "providerKind",
      "providerAccountId",
    ].every((key) => typeof entry[key] === "string") &&
    (entry.expiresAt === undefined || typeof entry.expiresAt === "string")
  );
}

/**
 * Revalidate immutable evidence in the same transaction as the first effect.
 * It is persistence-only: callers pass their transaction explicitly, so no
 * provider adapter needs to import a runtime singleton to enforce this fence.
 */
export async function assertRefundPolicyEvidenceAtFirstEffect(
  tx: Transaction,
  command: RefundCommand | SubscriptionCreditCommand,
  nativeTurnId: string,
) {
  const commandKind =
    "orderId" in command ? "refund-command" : "subscription-credit-command";
  const action = await tx.execute({
    sql: "SELECT data FROM support_actions WHERE case_id = ? AND kind = 'refund-policy-evidence' AND fingerprint = ?",
    args: [command.approvalCaseId, command.fingerprint],
  });
  if (!action.rows[0]) {
    const commandAction = await tx.execute({
      sql: "SELECT id FROM support_actions WHERE case_id = ? AND kind = ? AND fingerprint = ?",
      args: [command.approvalCaseId, commandKind, command.fingerprint],
    });
    if (!commandAction.rows[0]) return;
  }

  let stored: {
    turnId?: unknown;
    binding?: Record<string, unknown>;
    citations?: unknown;
  };
  let knowledgeBinding: ProviderBinding;
  try {
    stored = JSON.parse(text(action.rows[0]?.data)) as typeof stored;
    const originatingCase = await tx.execute({
      sql: "SELECT data FROM support_cases WHERE id = ?",
      args: [command.approvalCaseId],
    });
    const persisted = JSON.parse(text(originatingCase.rows[0]?.data)) as {
      externalId?: unknown;
      metadata?: unknown;
    };
    if (!persisted?.metadata || typeof persisted.metadata !== "object")
      throw new Error("missing originating case knowledge binding");
    knowledgeBinding = bindingsForCase({
      externalId: text(persisted.externalId),
      metadata: persisted.metadata as Record<string, unknown>,
    }).knowledge;
  } catch {
    throw refundPolicyEvidenceError(
      "the approved command has no parseable originating policy evidence binding",
    );
  }

  const citations = Array.isArray(stored.citations) ? stored.citations : [];
  const binding = stored.binding;
  if (
    stored.turnId !== nativeTurnId ||
    !binding ||
    binding.tenantId !== command.binding.tenantId ||
    binding.tenantId !== knowledgeBinding.tenantId ||
    binding.providerKind !== knowledgeBinding.providerKind ||
    binding.providerAccountId !== knowledgeBinding.providerAccountId ||
    citations.length === 0 ||
    !citations.every(isRefundPolicyEvidence)
  )
    throw refundPolicyEvidenceError(
      "the approved command is not bound to complete originating policy evidence",
    );

  const accountKey = knowledgeAccountKey(knowledgeBinding);
  const publication = await tx.execute({
    sql: "SELECT generation_id FROM support_knowledge_publications WHERE account_key = ?",
    args: [accountKey],
  });
  const activeGeneration = publication.rows[0]?.generation_id;
  const now = Date.now();
  for (const citation of citations) {
    if (activeGeneration !== citation.generationId)
      throw refundPolicyEvidenceError(
        "the cited policy generation is no longer the active publication",
      );
    const authoritative = await tx.execute({
      sql: "SELECT d.*, g.account_key AS generation_account_key, g.tenant_id AS generation_tenant_id, g.provider_kind AS generation_provider_kind, g.provider_account_id AS generation_provider_account_id, g.state AS generation_state FROM support_knowledge_documents d JOIN support_knowledge_generations g ON g.id = d.generation_id WHERE d.generation_id = ? AND d.source = ? AND d.document_hash = ?",
      args: [citation.generationId, citation.source, citation.documentHash],
    });
    const row = authoritative.rows[0] as Record<string, unknown> | undefined;
    const effectiveAt = Date.parse(text(row?.effective_at));
    const expiresAt = row?.expires_at
      ? Date.parse(text(row.expires_at))
      : undefined;
    if (
      !row ||
      row.generation_state !== "active" ||
      text(row.generation_account_key) !== accountKey ||
      text(row.generation_tenant_id) !== knowledgeBinding.tenantId ||
      text(row.generation_provider_kind) !== knowledgeBinding.providerKind ||
      text(row.generation_provider_account_id) !==
        knowledgeBinding.providerAccountId ||
      text(row.title) !== citation.title ||
      text(row.version) !== citation.version ||
      text(row.effective_at) !== citation.effectiveAt ||
      text(row.indexed_at) !== citation.indexedAt ||
      (row.expires_at ? text(row.expires_at) : undefined) !==
        citation.expiresAt ||
      text(row.provider_kind) !== citation.providerKind ||
      text(row.provider_account_id) !== citation.providerAccountId ||
      citation.providerKind !== knowledgeBinding.providerKind ||
      citation.providerAccountId !== knowledgeBinding.providerAccountId ||
      !Number.isFinite(effectiveAt) ||
      effectiveAt > now ||
      (expiresAt !== undefined &&
        (!Number.isFinite(expiresAt) || expiresAt <= now))
    )
      throw refundPolicyEvidenceError(
        "the cited policy is missing, altered, inactive, or outside its applicability window",
      );
  }
}

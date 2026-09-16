import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";
import type {
  DeliveryReceipt,
  ProviderBinding,
  SupportChannelProvider,
} from "../providers/contracts";

const LOCAL = "local" as const;

/** The local adapter's binding is a fixture boundary, not a workflow concern. */
export const defaultLocalBinding = (
  externalConversationId = "local",
): ProviderBinding => ({
  tenantId: "local-demo",
  providerKind: LOCAL,
  providerAccountId: "local-demo",
  externalConversationId,
});

/** Local support transport keeps inbound normalization and idempotent delivery
 * together, while the runtime retains commerce and recovery orchestration. */
export class LocalSupportProvider implements SupportChannelProvider {
  readonly kind = LOCAL;
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async normalizeInbound(payload: unknown) {
    const value = payload as {
      externalId?: string;
      from?: string;
      fromName?: string;
      subject?: string;
      body?: string;
      receivedAt?: string;
      conversationId?: string;
    };
    if (!value?.externalId || !value.from || !value.body)
      throw new Error("Invalid local inbound payload.");
    const createdAt = value.receivedAt ?? new Date().toISOString();
    return {
      binding: defaultLocalBinding(value.conversationId ?? value.externalId),
      externalId: value.externalId,
      source: "mock-email" as const,
      customer: { email: value.from, name: value.fromName },
      subject: value.subject || "(no subject)",
      message: {
        id: `msg_${crypto.randomUUID().slice(0, 8)}`,
        author: "customer" as const,
        authorName: value.fromName ?? value.from,
        body: value.body,
        createdAt,
      },
      rawPayload: value as Record<string, unknown>,
    };
  }

  async deliver(
    binding: ProviderBinding,
    body: string,
    status: string,
    idempotencyKey?: string,
  ): Promise<DeliveryReceipt> {
    await this.ready;
    const key = idempotencyKey ?? `direct_${crypto.randomUUID()}`;
    const payloadFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: binding.tenantId,
          providerKind: binding.providerKind,
          providerAccountId: binding.providerAccountId,
          externalConversationId: binding.externalConversationId,
          body,
          status,
        }),
      )
      .digest("hex");
    const existing = await this.client.execute({
      sql: "SELECT payload_fingerprint, receipt FROM local_deliveries WHERE tenant_id = ? AND provider_account_id = ? AND idempotency_key = ?",
      args: [binding.tenantId, binding.providerAccountId, key],
    });
    if (existing.rows[0]) {
      if (String(existing.rows[0].payload_fingerprint) !== payloadFingerprint)
        throw new Error(
          "Delivery idempotency key was reused with different content.",
        );
      return JSON.parse(String(existing.rows[0].receipt)) as DeliveryReceipt;
    }
    const receipt: DeliveryReceipt = {
      receiptId: `receipt_${crypto.randomUUID()}`,
      deliveredAt: new Date().toISOString(),
      providerMessageId: `local_${crypto.randomUUID()}`,
    };
    try {
      await this.client.execute({
        sql: "INSERT INTO local_deliveries(tenant_id, provider_account_id, idempotency_key, payload_fingerprint, receipt) VALUES (?, ?, ?, ?, ?)",
        args: [
          binding.tenantId,
          binding.providerAccountId,
          key,
          payloadFingerprint,
          JSON.stringify(receipt),
        ],
      });
    } catch (error) {
      const raced = await this.client.execute({
        sql: "SELECT payload_fingerprint, receipt FROM local_deliveries WHERE tenant_id = ? AND provider_account_id = ? AND idempotency_key = ?",
        args: [binding.tenantId, binding.providerAccountId, key],
      });
      if (!raced.rows[0]) throw error;
      if (String(raced.rows[0].payload_fingerprint) !== payloadFingerprint)
        throw new Error(
          "Delivery idempotency key was reused with different content.",
        );
      return JSON.parse(String(raced.rows[0].receipt)) as DeliveryReceipt;
    }
    return receipt;
  }

  async addInternalNote(
    binding: ProviderBinding,
    body: string,
    idempotencyKey: string,
  ) {
    return this.deliver(binding, body, "note", idempotencyKey);
  }

  async updateStatus(
    binding: ProviderBinding,
    status: string,
    idempotencyKey: string,
  ) {
    return this.deliver(binding, "", status, idempotencyKey);
  }
}

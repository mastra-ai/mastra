import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { intercomBinding, type IntercomDevelopmentConfig } from "./config";

export const MAX_INTERCOM_WEBHOOK_BYTES = 256 * 1024;
const MAX_EVENT_AGE_MS = 5 * 60 * 1000;
const notificationSchema = z
  .object({
    type: z.literal("notification_event"),
    id: z.string().min(1).max(200),
    app_id: z.string().min(1).max(200),
    topic: z.string().min(1).max(200),
    created_at: z.number().int(),
    data: z.object({ item: z.record(z.string(), z.unknown()) }),
  })
  .passthrough();

/** Intercom's endpoint validation notification is not a conversation event.
 * Its provider envelope may intentionally have no notification ID. */
const pingSchema = z
  .object({
    type: z.literal("notification_event"),
    id: z.string().min(1).max(200).nullable(),
    app_id: z.string().min(1).max(200),
    topic: z.literal("ping"),
    created_at: z.number().int(),
    data: z.object({
      item: z
        .object({
          type: z.literal("ping"),
          message: z.string().min(1).max(2_000),
        })
        .passthrough(),
    }),
  })
  .passthrough();

type AuthenticatedIntercomNotification = z.infer<typeof notificationSchema>;

export type VerifiedIntercomPing = z.infer<typeof pingSchema> & {
  kind: "ping";
};

export type VerifiedIntercomConversationWebhook =
  AuthenticatedIntercomNotification & {
    kind: "conversation";
    binding: ReturnType<typeof intercomBinding>;
  };

/** A ping proves Intercom can reach this endpoint, but it cannot identify a
 * customer conversation. All other accepted notifications retain the bound
 * conversation identity required by their downstream handling. */
export type VerifiedIntercomWebhook =
  VerifiedIntercomPing | VerifiedIntercomConversationWebhook;

function suppliedSignature(value: string | null) {
  if (!value?.startsWith("sha1=")) return undefined;
  const hex = value.slice(5);
  return /^[a-f0-9]{40}$/i.test(hex) ? hex : undefined;
}

function assertAccountAndFreshness(
  event: Pick<AuthenticatedIntercomNotification, "app_id" | "created_at">,
  config: IntercomDevelopmentConfig,
  at: number,
) {
  if (event.app_id !== config.accountId)
    throw new Error(
      "Intercom webhook account does not match configured account.",
    );
  const age = at - event.created_at * 1_000;
  if (age > MAX_EVENT_AGE_MS || age < -MAX_EVENT_AGE_MS)
    throw new Error(
      "Intercom webhook timestamp is outside the accepted window.",
    );
}

/** Verify raw bytes before JSON parsing.  Freshness uses the authenticated
 * notification timestamp only after the signature proves its provenance. */
export function verifyIntercomWebhook(
  rawBody: Uint8Array,
  headers: Headers,
  config: IntercomDevelopmentConfig,
  at = Date.now(),
): VerifiedIntercomWebhook {
  if (
    rawBody.byteLength === 0 ||
    rawBody.byteLength > MAX_INTERCOM_WEBHOOK_BYTES
  )
    throw new Error("Intercom webhook body is outside the accepted size.");
  const contentType = headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.toLowerCase();
  if (contentType !== "application/json")
    throw new Error("Intercom webhook must be application/json.");
  const actual = suppliedSignature(headers.get("x-hub-signature"));
  if (!actual)
    throw new Error("Intercom webhook signature is missing or invalid.");
  const expected = createHmac("sha1", config.clientSecret)
    .update(rawBody)
    .digest("hex");
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  )
    throw new Error("Intercom webhook signature is invalid.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    throw new Error("Intercom webhook contains invalid JSON.");
  }
  // `id: null` is an Intercom setup-ping shape, never a conversation event.
  // Narrow only after authenticating the bounded raw request; every other
  // notification remains subject to the required non-empty ID schema.
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "topic" in parsed &&
    parsed.topic === "ping"
  ) {
    const ping = pingSchema.parse(parsed);
    assertAccountAndFreshness(ping, config, at);
    return { ...ping, kind: "ping" };
  }
  const event = notificationSchema.parse(parsed);
  assertAccountAndFreshness(event, config, at);
  const conversationId = event.data.item.id;
  if (
    typeof conversationId !== "string" ||
    conversationId.trim().length === 0 ||
    conversationId.length > 200
  )
    throw new Error("Intercom webhook has no conversation identity.");
  return {
    ...event,
    kind: "conversation",
    binding: intercomBinding(config, conversationId),
  };
}

export function isCustomerConversationEvent(
  event: VerifiedIntercomConversationWebhook,
) {
  return (
    event.topic === "conversation.user.created" ||
    event.topic === "conversation.user.replied"
  );
}

/** Only this explicit topic may converge an existing case from the provider.
 * Replies and notes stay ignored so app-originated activity cannot loop. */
export function isAdminClosedConversationEvent(
  event: VerifiedIntercomConversationWebhook,
) {
  return event.topic === "conversation.admin.closed";
}

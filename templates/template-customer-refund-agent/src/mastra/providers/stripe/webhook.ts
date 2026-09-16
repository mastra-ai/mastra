import { createHmac, timingSafeEqual } from "node:crypto";
import {
  stripeWebhookEnvelopeSchema,
  STRIPE_API_VERSION,
  type StripeSandboxConfig,
} from "./config";

export const MAX_STRIPE_WEBHOOK_BYTES = 256 * 1024;
const MAX_EVENT_AGE_MS = 5 * 60 * 1_000;

function signatureHeader(value: string | null) {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim().split("=", 2) as [string, string]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  // Stripe may send more than one v1 value while endpoint secrets rotate.
  // Accept any valid signature; retaining only the last one rejects valid
  // delivery based on arbitrary header ordering.
  const signatures = parts
    .filter(
      ([key, signature]) => key === "v1" && /^[a-f0-9]{64}$/i.test(signature),
    )
    .map(([, signature]) => signature);
  if (!Number.isSafeInteger(timestamp) || signatures.length === 0)
    return undefined;
  return { timestamp, signatures };
}

/** Verifies bounded raw bytes before parse. Stripe event version, test mode and
 * account are all boundary checks, not hints from untrusted JSON. */
export function verifyStripeWebhook(
  raw: Uint8Array,
  headers: Headers,
  config: StripeSandboxConfig,
  at = Date.now(),
) {
  if (!raw.byteLength || raw.byteLength > MAX_STRIPE_WEBHOOK_BYTES)
    throw new Error("Stripe webhook body is outside the accepted size.");
  if (
    headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !==
    "application/json"
  )
    throw new Error("Stripe webhook must be application/json.");
  const supplied = signatureHeader(headers.get("stripe-signature"));
  if (!supplied || Math.abs(at - supplied.timestamp * 1_000) > MAX_EVENT_AGE_MS)
    throw new Error("Stripe webhook signature timestamp is invalid.");
  const expected = createHmac("sha256", config.webhookSecret)
    .update(`${supplied.timestamp}.${Buffer.from(raw).toString("utf8")}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const matched = supplied.signatures.some((signature) => {
    const actualBytes = Buffer.from(signature, "hex");
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  });
  if (!matched) throw new Error("Stripe webhook signature is invalid.");
  const event = stripeWebhookEnvelopeSchema.parse(
    JSON.parse(Buffer.from(raw).toString("utf8")),
  );
  // `account` identifies the connected account for Connect events. A direct
  // account webhook normally omits it, so omission is not an account mismatch.
  if (
    event.api_version !== STRIPE_API_VERSION ||
    (event.account !== undefined && event.account !== config.accountId)
  )
    throw new Error(
      "Stripe webhook version or account does not match configuration.",
    );
  return event;
}

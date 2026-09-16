import { createHash } from "node:crypto";
import type {
  Money,
  RefundCommand,
  SubscriptionCreditCommand,
} from "../providers/contracts";

// The demo accepts only currencies whose display precision is known.  Keeping
// this table here prevents the legacy/UI decimal edge from silently treating a
// zero- or three-decimal currency as cents.
const currencyExponents: Record<string, number> = {
  USD: 2,
  EUR: 2,
  BRL: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  BHD: 3,
};

function exponent(currency: string) {
  const value = currencyExponents[currency];
  if (value === undefined)
    throw new Error(`Unsupported currency precision for ${currency}.`);
  return value;
}

/** Provider adapters receive already-minor-unit amounts.  They still need to
 * reject a currency whose exponent this application does not understand: a
 * syntactically valid three-letter code is not enough to make an amount safe. */
export function assertSupportedCurrency(currency: string) {
  exponent(currency);
  return currency;
}

export function money(currency: string, minor: number): Money {
  if (!/^[A-Z]{3}$/.test(currency))
    throw new Error("Currency must be an ISO 4217 uppercase code.");
  assertSupportedCurrency(currency);
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error(
      "Money must be a non-negative safe integer minor-unit value.",
    );
  return { currency, minor };
}

/** Immutable persisted commands are semantic values, not serialized JSON.
 * Object key order is deliberately ignored while array order remains material. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function structurallyEqual(left: unknown, right: unknown) {
  return canonicalJson(left) === canonicalJson(right);
}

/** Compatibility conversion is allowed only at the existing agent/UI edge. */
export function legacyAmountToMoney(amount: number, currency: string): Money {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Refund amount must be positive.");
  const scale = 10 ** exponent(currency);
  const minor = Math.round(amount * scale);
  if (Math.abs(amount * scale - minor) > 1e-8)
    throw new Error(
      "Refund amount has more precision than the currency supports.",
    );
  return money(currency, minor);
}

export function moneyToLegacyAmount(value: Money): number {
  return value.minor / 10 ** exponent(value.currency);
}

export function refundFingerprint(
  command: Omit<RefundCommand, "fingerprint">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        approvalCaseId: command.approvalCaseId,
        tenantId: command.binding.tenantId,
        account: command.binding.providerAccountId,
        orderId: command.orderId,
        currency: command.amount.currency,
        minor: command.amount.minor,
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
      }),
    )
    .digest("hex");
}

export function subscriptionCreditFingerprint(
  command: Omit<SubscriptionCreditCommand, "fingerprint">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        action: "subscription_credit",
        approvalCaseId: command.approvalCaseId,
        tenantId: command.binding.tenantId,
        account: command.binding.providerAccountId,
        customerId: command.customerId,
        subscriptionId: command.subscriptionId,
        currency: command.amount.currency,
        minor: command.amount.minor,
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
      }),
    )
    .digest("hex");
}

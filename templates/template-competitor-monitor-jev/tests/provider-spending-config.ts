// Cumulative project authorization in USD, including retries, tests and demonstrations.
// These values do not implement accounting: callers still need durable reservations.
export const PROJECT_BUDGET_USD = {
  // Cumulative authorization for explicitly invoked Jev tests.
  jev: 4.5,
  // Cumulative authorization for explicitly invoked OpenAI tests.
  openai: 5,
} as const;

// Reference tariff only; verify actual billing before paid work. No environment overrides.
export const PRICING_REFERENCE = {
  checkedAt: '2026-09-27',
  // Tokens per quoted pricing unit; fixed unit conversion, not a tokenizer estimate.
  tokensPerPricingUnit: 1_000_000,
  // USD/million input tokens; published TypeSafe reference, subject to account verification.
  jevInputUsdPerMillion: 0.042,
  // USD/million output tokens; published free output, not proof that usage is absent.
  jevOutputUsdPerMillion: 0,
} as const;

export const CLASSIFICATION_LIMITS = {
  // Tokens/native evaluation request; published TypeSafe full-context ceiling used for conservative reservation.
  jevMaxInputTokens: 65_536,
  // Integer microdollars/USD; avoids floating-point budget comparison drift in durable reservations.
  usdReservationUnits: 1_000_000,
} as const;

// USD reserved for each actual Jev request in paid tests; native retries reserve again.
export const JEV_TEST_CALL_RESERVATION_USD =
  (CLASSIFICATION_LIMITS.jevMaxInputTokens * PRICING_REFERENCE.jevInputUsdPerMillion) /
  PRICING_REFERENCE.tokensPerPricingUnit;

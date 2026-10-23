/**
 * Removes credential-like fields from a provider response before it leaves a
 * tool. Generated tools apply this to results whose upstream contract carries
 * secrets an agent never needs, such as webhook signing secrets. Only top-level
 * fields are removed; nested objects are returned untouched.
 */
export function withoutSecretFields<T extends Record<string, unknown>, K extends string>(
  value: T,
  fields: readonly K[],
): Omit<T, K> {
  const redacted: Record<string, unknown> = { ...value };
  for (const field of fields) delete redacted[field];
  return redacted as Omit<T, K>;
}

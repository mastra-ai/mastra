export function optionalBoolean(name: string, value: string | undefined, label: string): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  console.warn(`[${label}] ${name} must be true or false; received ${JSON.stringify(value)}.`);
  return undefined;
}

export function optionalPositiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value?.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

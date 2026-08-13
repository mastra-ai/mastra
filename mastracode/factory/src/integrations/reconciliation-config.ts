export function optionalPositiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value?.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

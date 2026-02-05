export const POSTGRES_IDENTIFIER_MAX_LENGTH = 63;

export function truncateIdentifier(value: string, maxLength = POSTGRES_IDENTIFIER_MAX_LENGTH): string {
  if (!maxLength || Buffer.byteLength(value, 'utf-8') <= maxLength) {
    return value;
  }

  let truncated = value;
  while (truncated && Buffer.byteLength(truncated, 'utf-8') > maxLength) {
    truncated = truncated.slice(0, -1);
  }
  return truncated;
}

export function buildConstraintName({
  baseName,
  schemaName,
  maxLength = POSTGRES_IDENTIFIER_MAX_LENGTH,
}: {
  baseName: string;
  schemaName?: string;
  maxLength?: number;
}): string {
  const prefix = schemaName ? `${schemaName}_` : '';
  return truncateIdentifier(`${prefix}${baseName}`, maxLength);
}

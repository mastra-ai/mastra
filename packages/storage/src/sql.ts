export type SqlIdentifier = string & { __brand: 'SqlIdentifier' };
export type FieldKey = string & { __brand: 'FieldKey' };

export const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function parseSqlIdentifier(name: string, kind = 'identifier'): SqlIdentifier {
  if (!SQL_IDENTIFIER_PATTERN.test(name) || name.length > 63) {
    throw new Error(
      `Invalid ${kind}: ${name}. Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long.`,
    );
  }
  return name as SqlIdentifier;
}

export function parseFieldKey(key: string): FieldKey {
  if (!key) throw new Error('Field key cannot be empty');
  const segments = key.split('.');
  for (const segment of segments) {
    if (!SQL_IDENTIFIER_PATTERN.test(segment) || segment.length > 63) {
      throw new Error(`Invalid field key segment: ${segment} in ${key}`);
    }
  }
  return key as FieldKey;
}

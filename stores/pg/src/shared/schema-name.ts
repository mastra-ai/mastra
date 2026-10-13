const POSTGRES_IDENTIFIER_MAX_BYTES = 63;

// A schema name is always written inside double quotes, and in a few places inside a
// single-quoted literal or a `$$`-quoted DO block. Reject every character that could end
// one of those, plus control characters.
const UNSAFE_SCHEMA_NAME_CHARS = /["'\\$\u0000-\u001f\u007f]/;

/**
 * Validates a PostgreSQL schema name.
 *
 * Schema names are always double-quoted in generated SQL, so PostgreSQL accepts any name
 * that fits the identifier limit (for example `my-tenant`). Quotes, backslashes, `$` and
 * control characters are rejected so the name can never break out of a quoted identifier,
 * a string literal, or a dollar-quoted block.
 */
export function parseSchemaName(name: string, kind = 'schema name'): string {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    UNSAFE_SCHEMA_NAME_CHARS.test(name) ||
    Buffer.byteLength(name, 'utf-8') > POSTGRES_IDENTIFIER_MAX_BYTES
  ) {
    throw new Error(
      `Invalid ${kind}: ${name}. Must be 1-${POSTGRES_IDENTIFIER_MAX_BYTES} bytes long and must not contain quotes, backslashes, "$", or control characters.`,
    );
  }
  return name;
}

/**
 * Turns a schema name into a string that is safe to use as part of an unquoted identifier,
 * such as the schema prefix of an index or constraint name.
 *
 * Names that are already plain identifiers (letters, digits, underscores) are returned
 * unchanged, so existing index and constraint names keep working. Any other character
 * becomes `_`, e.g. `my-tenant` -> `my_tenant`.
 */
export function schemaNamePrefix(name: string): string {
  const sanitized = parseSchemaName(name).replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(sanitized) ? `_${sanitized}` : sanitized;
}

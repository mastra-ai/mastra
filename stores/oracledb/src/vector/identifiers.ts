import { createHash } from 'node:crypto';

// Oracle object names are capped at 128 bytes, while Mastra index names are user-facing labels.
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_LOGICAL_INDEX_NAME_LENGTH = 512;

// Strict identifiers are used only for physical Oracle objects and schema names.
export function normalizeIdentifier(value: string, label: string): string {
  const normalized = value.trim().toUpperCase();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new Error(`${label} must start with a letter and contain only letters, numbers, and underscores`);
  }
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`${label} must be ${MAX_IDENTIFIER_LENGTH} characters or fewer`);
  }
  return normalized;
}

// Logical names stay case-sensitive and broad enough for app-level index naming.
export function normalizeLogicalIndexName(value: string, label = 'index name'): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must be provided and cannot be empty`);
  }
  if (normalized.length > MAX_LOGICAL_INDEX_NAME_LENGTH) {
    throw new Error(`${label} must be ${MAX_LOGICAL_INDEX_NAME_LENGTH} characters or fewer`);
  }
  return normalized;
}

// Existing registry rows used uppercase Oracle identifiers, so lookups keep that fallback path.
export function legacyCanonicalIndexName(value: string): string {
  return normalizeIdentifier(value, 'legacy index name');
}

export function quoteIdentifier(value: string, label: string): string {
  return `"${normalizeIdentifier(value, label)}"`;
}

export function qualifyName(name: string, schemaName?: string): string {
  const quotedName = quoteIdentifier(name, 'object name');
  if (!schemaName) return quotedName;
  return `${quoteIdentifier(schemaName, 'schema name')}.${quotedName}`;
}

// Physical table names are deterministic and safe even when logical names contain URL-like tokens.
export function tableNameForIndex(indexName: string, tablePrefix = 'MASTRA_VEC'): string {
  const prefix = normalizeIdentifier(tablePrefix, 'table prefix');
  const logicalIndexName = normalizeLogicalIndexName(indexName);
  const legacyCompatibleIndexName = tryNormalizeIdentifier(logicalIndexName);
  const index = legacyCompatibleIndexName ?? safeIdentifierSegment(logicalIndexName, 'IDX');
  const base = `${prefix}_${index}`;
  if (base.length <= MAX_IDENTIFIER_LENGTH) return base;

  const hash = shortHash(`${prefix}:${logicalIndexName}`);
  return `${base.slice(0, MAX_IDENTIFIER_LENGTH - hash.length - 1)}_${hash}`;
}

// Derived index names share the table prefix and are shortened with a stable suffix when needed.
export function indexNameForTable(tableName: string, suffix: string): string {
  const base = `${normalizeIdentifier(tableName, 'table name')}_${normalizeIdentifier(suffix, 'index suffix')}`;
  if (base.length <= MAX_IDENTIFIER_LENGTH) return base;

  const hash = shortHash(base);
  return `${base.slice(0, MAX_IDENTIFIER_LENGTH - hash.length - 1)}_${hash}`;
}

export function indexNameForMetadataField(tableName: string, field: string): string {
  const hash = shortHash(field);
  return indexNameForTable(tableName, `MD_${hash}_IDX`);
}

// JSON paths are quoted per segment so metadata keys never become SQL syntax.
export function assertJsonPath(path: string): string {
  const parts = path.split('.');
  if (parts.length === 0 || parts.some(part => part.length === 0)) {
    throw new Error(`Invalid JSON metadata path: ${path}`);
  }
  return `$${parts.map(jsonPathSegment).join('')}`;
}

// Oracle JSON_EXISTS predicates use @ as the current item instead of the root $ token.
export function jsonPathForPredicatePrefix(path: string): string {
  const fullPath = assertJsonPath(path);
  return `@${fullPath.slice(1)}`;
}

function tryNormalizeIdentifier(value: string): string | null {
  try {
    return normalizeIdentifier(value, 'identifier');
  } catch {
    return null;
  }
}

function safeIdentifierSegment(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const withFallback = sanitized || fallback;
  const segment = /^[A-Z]/.test(withFallback) ? withFallback : `${fallback}_${withFallback}`;
  if (segment.length <= MAX_IDENTIFIER_LENGTH) return segment;

  const hash = shortHash(value);
  return `${segment.slice(0, MAX_IDENTIFIER_LENGTH - hash.length - 1)}_${hash}`;
}

function jsonPathSegment(part: string): string {
  if (IDENTIFIER_PATTERN.test(part)) {
    return `.${part}`;
  }
  if (/[\u0000-\u001F]/.test(part)) {
    throw new Error(`Invalid JSON metadata path: ${part}`);
  }
  const escaped = part.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "''");
  return `."${escaped}"`;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12).toUpperCase();
}

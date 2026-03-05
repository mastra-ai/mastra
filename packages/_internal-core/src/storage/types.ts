import type { z } from 'zod';
import { getZodInnerType, getZodTypeName } from '../zod-utils.js';

export type StoragePagination = {
  page: number;
  perPage: number | false;
};

export type StorageColumnType = 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'float' | 'bigint' | 'boolean';

export interface StorageColumn {
  type: StorageColumnType;
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface StorageTableConfig {
  columns: Record<string, StorageColumn>;
  compositePrimaryKey?: string[];
}

export type PaginationInfo = {
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
};

export type ThreadOrderBy = 'createdAt' | 'updatedAt';
export type ThreadSortDirection = 'ASC' | 'DESC';

export interface StorageOrderBy<TField extends ThreadOrderBy = ThreadOrderBy> {
  field?: TField;
  direction?: ThreadSortDirection;
}

export interface ThreadSortOptions {
  orderBy?: ThreadOrderBy;
  sortDirection?: ThreadSortDirection;
}

function unwrapSchema(schema: z.ZodTypeAny): { base: z.ZodTypeAny; nullable: boolean } {
  let current = schema;
  let nullable = false;

  while (true) {
    const typeName = getZodTypeName(current);
    if (!typeName) break;

    if (typeName === 'ZodNullable' || typeName === 'ZodOptional') {
      nullable = true;
    }

    const inner = getZodInnerType(current, typeName);
    if (!inner) break;
    current = inner;
  }

  return { base: current, nullable };
}

/**
 * Extract checks array from Zod schema, compatible with both Zod 3 and Zod 4.
 * Zod 3 uses _def.checks, Zod 4 uses _zod.def.checks.
 */
function getZodChecks(schema: z.ZodTypeAny): Array<{ kind: string }> {
  const schemaAny = schema as any;
  // Zod 4 structure
  if (schemaAny._zod?.def?.checks) {
    return schemaAny._zod.def.checks;
  }
  // Zod 3 structure
  if (schemaAny._def?.checks) {
    return schemaAny._def.checks;
  }
  return [];
}

function zodToStorageType(schema: z.ZodTypeAny): StorageColumnType {
  const typeName = getZodTypeName(schema);

  if (typeName === 'ZodString') {
    // Check for UUID validation
    const checks = getZodChecks(schema);
    if (checks.some(c => c.kind === 'uuid')) {
      return 'uuid';
    }
    return 'text';
  }
  if (typeName === 'ZodNativeEnum' || typeName === 'ZodEnum') {
    return 'text';
  }
  if (typeName === 'ZodNumber') {
    // Check for integer validation
    const checks = getZodChecks(schema);
    return checks.some(c => c.kind === 'int') ? 'integer' : 'float';
  }
  if (typeName === 'ZodBigInt') {
    return 'bigint';
  }
  if (typeName === 'ZodDate') {
    return 'timestamp';
  }
  if (typeName === 'ZodBoolean') {
    return 'boolean';
  }
  // fall back for objects/records/unknown
  return 'jsonb';
}

/**
 * Converts a zod schema into a database schema
 * @param zObject A zod schema object
 * @returns database schema record with StorageColumns
 */
export function buildStorageSchema<Shape extends z.ZodRawShape>(
  zObject: z.ZodObject<Shape>,
): Record<keyof Shape & string, StorageColumn> {
  const shape = zObject.shape;
  const result: Record<string, StorageColumn> = {};

  for (const [key, field] of Object.entries(shape)) {
    const { base, nullable } = unwrapSchema(field as z.ZodTypeAny);
    result[key] = {
      type: zodToStorageType(base),
      nullable,
    };
  }

  return result as Record<keyof Shape & string, StorageColumn>;
}

import { z } from 'zod/v4';

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

export interface WorkflowRuns {
  runs: WorkflowRun[];
  total: number;
}

export interface StorageWorkflowRun {
  workflow_name: string;
  run_id: string;
  resourceId?: string;
  snapshot: unknown | string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRun {
  workflowName: string;
  runId: string;
  snapshot: unknown | string;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
}

export type PaginationInfo = {
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
};

export type MastraMessageFormat = 'v1' | 'v2';

export type StorageListWorkflowRunsInput = {
  workflowName?: string;
  fromDate?: Date;
  toDate?: Date;
  perPage?: number | false;
  page?: number;
  resourceId?: string;
  status?: string;
};

export type StorageResourceType = {
  id: string;
  workingMemory?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type StorageMessageType = {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: Date;
  resourceId: string | null;
};

export interface StorageOrderBy<TField extends ThreadOrderBy = ThreadOrderBy> {
  field?: TField;
  direction?: ThreadSortDirection;
}

export interface ThreadSortOptions {
  orderBy?: ThreadOrderBy;
  sortDirection?: ThreadSortDirection;
}

export type ThreadOrderBy = 'createdAt' | 'updatedAt';

export type ThreadSortDirection = 'ASC' | 'DESC';

export interface CreateIndexOptions {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  concurrent?: boolean;
  where?: string;
  method?: string;
  opclass?: Record<string, string>;
  storage?: Record<string, string>;
  tablespace?: string;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  size?: string;
  definition?: string;
}

export interface StorageIndexStats extends IndexInfo {
  scans?: number;
  tuples_read?: number;
  tuples_fetched?: number;
  last_used?: Date;
  method?: string;
}

export type TargetType = 'agent' | 'workflow' | 'scorer' | 'processor';

export interface DatasetRecord {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
  requestContextSchema?: Record<string, unknown>;
  tags?: string[] | null;
  targetType?: TargetType | null;
  targetIds?: string[] | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItemSource {
  type: 'csv' | 'json' | 'trace' | 'llm' | 'experiment-result';
  referenceId?: string;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  datasetVersion: number;
  input: unknown;
  groundTruth?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: DatasetItemSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItemRow {
  id: string;
  datasetId: string;
  datasetVersion: number;
  validTo: number | null;
  isDeleted: boolean;
  input: unknown;
  groundTruth?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: DatasetItemSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  createdAt: Date;
}

export function unwrapSchema(schema: z.ZodTypeAny): { base: z.ZodTypeAny; nullable: boolean } {
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

export function getZodChecks(schema: z.ZodTypeAny): Array<{ kind: string }> {
  if ('_zod' in schema) {
    const zodV4 = schema as { _zod?: { def?: { checks?: unknown[] } } };
    const checks = zodV4._zod?.def?.checks;

    if (checks && Array.isArray(checks)) {
      return checks.map((check: unknown) => {
        if (
          typeof check === 'object' &&
          check !== null &&
          'def' in check &&
          typeof check.def === 'object' &&
          check.def !== null
        ) {
          const def = check.def as Record<string, unknown>;

          if (def.check === 'number_format' && def.format === 'safeint') {
            return { kind: 'int' };
          }

          if (def.check === 'string_format' && typeof def.format === 'string') {
            return { kind: def.format };
          }

          return { kind: typeof def.check === 'string' ? def.check : 'unknown' };
        }

        return { kind: 'unknown' };
      });
    }
  }

  if ('_def' in schema) {
    const zodV3 = schema as unknown as { _def?: { checks?: Array<{ kind: string }> } };
    const checks = zodV3._def?.checks;

    if (checks && Array.isArray(checks)) {
      return checks;
    }
  }

  return [];
}

export function zodToStorageType(schema: z.ZodTypeAny): StorageColumnType {
  const typeName = getZodTypeName(schema);

  if (typeName === 'ZodString') {
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
    const checks = getZodChecks(schema);
    return checks.some(c => c.kind === 'int') ? 'integer' : 'float';
  }
  if (typeName === 'ZodBigInt' || typeName === 'ZodBigint') {
    return 'bigint';
  }
  if (typeName === 'ZodDate') {
    return 'timestamp';
  }
  if (typeName === 'ZodBoolean') {
    return 'boolean';
  }
  return 'jsonb';
}

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

export function getZodTypeName(schema: z.ZodTypeAny): string | undefined {
  const schemaAny = schema as any;

  if (schemaAny._def?.typeName) {
    return schemaAny._def.typeName;
  }

  const zod4Type = schemaAny._def?.type;
  if (typeof zod4Type === 'string' && zod4Type) {
    return 'Zod' + zod4Type.charAt(0).toUpperCase() + zod4Type.slice(1);
  }

  return undefined;
}

export function getZodInnerType(schema: z.ZodTypeAny, typeName: string): z.ZodTypeAny | undefined {
  const schemaAny = schema as any;

  if (typeName === 'ZodNullable' || typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    return schemaAny._zod?.def?.innerType ?? schemaAny._def?.innerType;
  }

  if (typeName === 'ZodEffects') {
    return schemaAny._zod?.def?.schema ?? schemaAny._def?.schema;
  }

  if (typeName === 'ZodBranded') {
    return schemaAny._zod?.def?.type ?? schemaAny._def?.type;
  }

  return undefined;
}

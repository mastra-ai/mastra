import { actionGeneric, mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';
import type { GenericId } from 'convex/values';

type NativeVectorFilterValue = string | number | boolean | null;
type NativeVectorFilterClause = {
  field: string;
  value: NativeVectorFilterValue;
};
type NativeVectorFilter = NativeVectorFilterClause | { $or: NativeVectorFilterClause[] };

type NativeVectorIndexConfig = {
  tableName: string;
  vectorIndexName: string;
  dimension?: number;
  idField?: string;
  idIndexName?: string;
  vectorField?: string;
  metadataField?: string;
  filterFields?: string[];
};

type NativeVectorDocument = Record<string, any> & {
  _id?: GenericId<string>;
};

const DEFAULT_ID_FIELD = 'id';
const DEFAULT_ID_INDEX = 'by_record_id';
const DEFAULT_VECTOR_FIELD = 'embedding';
const DEFAULT_METADATA_FIELD = 'metadata';
const NATIVE_VECTOR_BATCH_SIZE = 25;
const MAX_CONVEX_VECTOR_RESULTS = 256;

const nativeVectorFilterValueValidator = v.union(v.string(), v.number(), v.boolean(), v.null());
const nativeVectorFilterClauseValidator = v.object({
  field: v.string(),
  value: nativeVectorFilterValueValidator,
});
const nativeVectorFilterValidator = v.union(
  nativeVectorFilterClauseValidator,
  v.object({ $or: v.array(nativeVectorFilterClauseValidator) }),
);
const nativeVectorIndexConfigValidator = v.object({
  tableName: v.string(),
  vectorIndexName: v.string(),
  dimension: v.optional(v.number()),
  idField: v.optional(v.string()),
  idIndexName: v.optional(v.string()),
  vectorField: v.optional(v.string()),
  metadataField: v.optional(v.string()),
  filterFields: v.optional(v.array(v.string())),
});

function idField(config: NativeVectorIndexConfig): string {
  return config.idField ?? DEFAULT_ID_FIELD;
}

function idIndexName(config: NativeVectorIndexConfig): string {
  return config.idIndexName ?? DEFAULT_ID_INDEX;
}

function vectorField(config: NativeVectorIndexConfig): string {
  return config.vectorField ?? DEFAULT_VECTOR_FIELD;
}

function metadataField(config: NativeVectorIndexConfig): string {
  return config.metadataField ?? DEFAULT_METADATA_FIELD;
}

function asTableName(tableName: string): any {
  return tableName as any;
}

function asConvexId(id: string): GenericId<string> {
  return id as GenericId<string>;
}

function pickFilterFields(metadata: Record<string, any> | undefined, filterFields: string[] | undefined) {
  const fields: Record<string, any> = {};
  if (!metadata || !filterFields) return fields;

  for (const field of filterFields) {
    const value = metadata[field];
    if (value !== undefined) {
      fields[field] = value;
    }
  }

  return fields;
}

function isMetadataRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMetadataArray(metadata: unknown, idsLength: number): Array<Record<string, any>> | undefined {
  if (metadata === undefined) return undefined;
  if (!Array.isArray(metadata)) {
    throw new Error('Native vector upsert: metadata must be an array matching ids when provided');
  }
  if (metadata.length !== idsLength) {
    throw new Error(`Native vector upsert: metadata length (${metadata.length}) must match ids length (${idsLength})`);
  }
  if (!metadata.every(isMetadataRecord)) {
    throw new Error('Native vector upsert: metadata entries must be objects when provided');
  }
  return metadata;
}

function validateMetadataRecord(metadata: unknown): Record<string, any> | undefined {
  if (metadata === undefined) return undefined;
  if (!isMetadataRecord(metadata)) {
    throw new Error('Native vector update: metadata must be an object when provided');
  }
  return metadata;
}

function clearMissingFilterFields(
  patch: Record<string, any>,
  metadata: Record<string, any>,
  filterFields: string[] | undefined,
) {
  if (!filterFields) return;

  for (const field of filterFields) {
    if (metadata[field] === undefined) {
      patch[field] = undefined;
    }
  }
}

function omitVectorField(doc: NativeVectorDocument, config: NativeVectorIndexConfig): NativeVectorDocument {
  const { [vectorField(config)]: _, ...docWithoutVector } = doc;
  return docWithoutVector;
}

function buildRecord({
  config,
  id,
  vector,
  metadata,
}: {
  config: NativeVectorIndexConfig;
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}) {
  return {
    [idField(config)]: id,
    [vectorField(config)]: vector,
    ...(metadata !== undefined ? { [metadataField(config)]: metadata } : {}),
    ...pickFilterFields(metadata, config.filterFields),
  };
}

async function findByRecordId(
  ctx: any,
  config: NativeVectorIndexConfig,
  id: string,
): Promise<NativeVectorDocument | null> {
  return ctx.db
    .query(asTableName(config.tableName))
    .withIndex(idIndexName(config), (q: any) => q.eq(idField(config), id))
    .unique();
}

async function mapInBatches<TInput, TOutput>(
  inputs: TInput[],
  mapper: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = [];
  for (let index = 0; index < inputs.length; index += NATIVE_VECTOR_BATCH_SIZE) {
    results.push(
      ...(await Promise.all(
        inputs
          .slice(index, index + NATIVE_VECTOR_BATCH_SIZE)
          .map((input, batchIndex) => mapper(input, index + batchIndex)),
      )),
    );
  }
  return results;
}

function buildVectorFilter(q: any, filter?: NativeVectorFilter) {
  if (!filter) return undefined;

  if ('$or' in filter) {
    return q.or(...filter.$or.map(clause => q.eq(clause.field, clause.value)));
  }

  return q.eq(filter.field, filter.value);
}

export const mastraNativeVectorAction = actionGeneric({
  args: {
    config: nativeVectorIndexConfigValidator,
    vector: v.array(v.number()),
    limit: v.optional(v.number()),
    filter: v.optional(nativeVectorFilterValidator),
  },
  handler: async (ctx, args: any) => {
    const config = args.config as NativeVectorIndexConfig;
    const limit = args.limit as number | undefined;
    const filter = args.filter as NativeVectorFilter | undefined;

    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_CONVEX_VECTOR_RESULTS)) {
      throw new Error(`Native vector query: limit must be an integer between 1 and ${MAX_CONVEX_VECTOR_RESULTS}`);
    }

    const results = await ctx.vectorSearch(asTableName(config.tableName), config.vectorIndexName as any, {
      vector: args.vector,
      ...(limit !== undefined ? { limit } : {}),
      ...(filter ? { filter: (q: any) => buildVectorFilter(q, filter) } : {}),
    });

    return results.map(result => ({
      id: String(result._id),
      score: result._score,
    }));
  },
});

export const mastraNativeVectorQuery = queryGeneric({
  args: {
    op: v.union(v.literal('getByConvexIds'), v.literal('describe'), v.literal('listByIds')),
    config: nativeVectorIndexConfigValidator,
    ids: v.optional(v.array(v.string())),
    includeVector: v.optional(v.boolean()),
    countLimit: v.optional(v.number()),
  },
  handler: async (ctx, args: any) => {
    const config = args.config as NativeVectorIndexConfig;

    switch (args.op as string) {
      case 'getByConvexIds': {
        const ids = args.ids as string[];
        if (!ids) {
          throw new Error('Native vector query: ids are required');
        }
        const includeVector = args.includeVector === true;
        const docs = await mapInBatches(ids, id => ctx.db.get(asConvexId(id)));
        return docs
          .filter((doc): doc is NativeVectorDocument => Boolean(doc))
          .map(doc => (includeVector ? doc : omitVectorField(doc, config)));
      }

      case 'describe': {
        const limit = Math.max(1, Math.min(args.countLimit ?? 10000, 10000));
        const docs = await ctx.db.query(asTableName(config.tableName)).take(limit + 1);
        return {
          count: Math.min(docs.length, limit),
          countIsLimited: docs.length > limit,
        };
      }

      case 'listByIds': {
        const ids = args.ids as string[];
        if (!ids) {
          throw new Error('Native vector query: ids are required');
        }
        return mapInBatches(ids, id => findByRecordId(ctx, config, id));
      }

      default:
        throw new Error(`Unsupported native vector query operation: ${args.op}`);
    }
  },
});

export const mastraNativeVectorMutation = mutationGeneric({
  args: {
    op: v.union(v.literal('upsert'), v.literal('updateById'), v.literal('deleteByIds')),
    config: nativeVectorIndexConfigValidator,
    ids: v.optional(v.array(v.string())),
    vectors: v.optional(v.array(v.array(v.number()))),
    metadata: v.optional(v.any()),
    id: v.optional(v.string()),
    vector: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args: any) => {
    const config = args.config as NativeVectorIndexConfig;

    switch (args.op as string) {
      case 'upsert': {
        const ids = args.ids as string[];
        const vectors = args.vectors as number[][];

        if (!ids || !vectors) {
          throw new Error('Native vector upsert: ids and vectors are required');
        }
        if (vectors.length !== ids.length) {
          throw new Error(
            `Native vector upsert: vectors length (${vectors.length}) must match ids length (${ids.length})`,
          );
        }
        const metadata = validateMetadataArray(args.metadata, ids.length);
        if (new Set(ids).size !== ids.length) {
          throw new Error('Native vector upsert: ids must be unique');
        }

        await mapInBatches(ids, async (id, index) => {
          const record = buildRecord({
            config,
            id,
            vector: vectors[index]!,
            metadata: metadata?.[index],
          });
          const existing = await findByRecordId(ctx, config, id);
          if (existing?._id) {
            const { _id: _, _creationTime: __, ...patch } = record as NativeVectorDocument;
            if (metadata?.[index] !== undefined) {
              clearMissingFilterFields(patch, metadata[index]!, config.filterFields);
            }
            await ctx.db.patch(existing._id, patch);
          } else {
            await ctx.db.insert(asTableName(config.tableName), record);
          }
        });
        return { ok: true };
      }

      case 'updateById': {
        if (!args.id) {
          throw new Error('Native vector update: id is required');
        }
        const existing = await findByRecordId(ctx, config, args.id);
        if (!existing?._id) return { ok: true };

        const patch: Record<string, any> = {};
        if (args.vector) patch[vectorField(config)] = args.vector;
        const metadata = validateMetadataRecord(args.metadata);
        if (metadata !== undefined) {
          const existingMetadata = isMetadataRecord(existing[metadataField(config)])
            ? existing[metadataField(config)]
            : {};
          patch[metadataField(config)] = { ...existingMetadata, ...metadata };
          Object.assign(patch, pickFilterFields(patch[metadataField(config)], config.filterFields));
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }
        return { ok: true };
      }

      case 'deleteByIds': {
        const ids = args.ids as string[];
        if (!ids) {
          throw new Error('Native vector deleteByIds: ids are required');
        }
        const docs = await mapInBatches(ids, id => findByRecordId(ctx, config, id));
        await mapInBatches(
          docs.filter((doc): doc is NativeVectorDocument & { _id: GenericId<string> } => Boolean(doc?._id)),
          doc => ctx.db.delete(doc._id),
        );
        return { ok: true };
      }

      default:
        throw new Error(`Unsupported native vector mutation operation: ${args.op}`);
    }
  },
});

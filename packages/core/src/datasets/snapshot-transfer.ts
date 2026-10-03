import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { createDatasetSnapshot, DATASET_SNAPSHOT_DEFAULT_MAX_BYTES, parseDatasetSnapshot } from './snapshot';
import type { DatasetSnapshot } from './snapshot';

const referenceSchema = z.string().min(1);
const maxBytesSchema = z.number().int().positive().default(DATASET_SNAPSHOT_DEFAULT_MAX_BYTES);
const tenancySchema = z.strictObject({
  organizationId: referenceSchema.nullable().optional(),
  projectId: referenceSchema.nullable().optional(),
});

export const datasetSnapshotExportOptionsSchema = z.strictObject({
  version: z.number().int().nonnegative().optional(),
  acknowledgeSensitiveData: z.literal(true),
  maxBytes: maxBytesSchema,
});

const referenceMappingsSchema = z
  .array(z.strictObject({ from: referenceSchema, to: referenceSchema }))
  .superRefine((mappings, ctx) => {
    const sources = new Set<string>();
    mappings.forEach((mapping, index) => {
      if (sources.has(mapping.from)) {
        ctx.addIssue({ code: 'custom', path: [index, 'from'], message: 'Duplicate reference mapping source' });
      }
      sources.add(mapping.from);
    });
  });

export const datasetSnapshotImportOptionsSchema = z.strictObject({
  idempotencyKey: z.string().min(1).max(256),
  destination: tenancySchema.extend({ name: z.string().optional() }).default({}),
  targetMappings: referenceMappingsSchema.default([]),
  scorerMappings: referenceMappingsSchema.default([]),
  maxBytes: maxBytesSchema,
});

export type DatasetSnapshotExportOptions = z.input<typeof datasetSnapshotExportOptionsSchema>;
export type DatasetSnapshotImportOptions = z.input<typeof datasetSnapshotImportOptionsSchema>;
export type DatasetSnapshotReferenceMapping = z.infer<typeof referenceMappingsSchema>[number];

/** Resolve only explicit reference mappings; never infer identity from names or positions. */
function mapReferences(ids: string[] | null | undefined, mappings: Map<string, string>): string[] | null | undefined {
  return ids?.map(id => mappings.get(id) ?? id) ?? ids;
}

function sortedMappings(mappings: DatasetSnapshotReferenceMapping[]): DatasetSnapshotReferenceMapping[] {
  return [...mappings].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** Scope receipts independently of the dataset, so deletion cannot permit an accidental second import. */
export function datasetSnapshotReceiptId(input: {
  idempotencyKey: string;
  organizationId?: string | null;
  projectId?: string | null;
}): string {
  const { idempotencyKey } = datasetSnapshotImportOptionsSchema.pick({ idempotencyKey: true }).parse({
    idempotencyKey: input.idempotencyKey,
  });
  const scope = tenancySchema.parse({ organizationId: input.organizationId, projectId: input.projectId });
  return createHash('sha256')
    .update(JSON.stringify([scope.organizationId ?? null, scope.projectId ?? null, idempotencyKey]))
    .digest('hex');
}

/** Parse once before storage access. Operational byte limits do not change request identity. */
export function prepareDatasetSnapshotImport(text: string, input: DatasetSnapshotImportOptions) {
  const options = datasetSnapshotImportOptionsSchema.parse(input);
  const snapshot = parseDatasetSnapshot(text, { maxBytes: options.maxBytes });
  const targetMappings = sortedMappings(options.targetMappings);
  const scorerMappings = sortedMappings(options.scorerMappings);
  const targetMap = new Map(targetMappings.map(mapping => [mapping.from, mapping.to]));
  const scorerMap = new Map(scorerMappings.map(mapping => [mapping.from, mapping.to]));
  const destination = {
    name: options.destination.name ?? snapshot.configuration.name,
    organizationId: options.destination.organizationId ?? null,
    projectId: options.destination.projectId ?? null,
  };
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify([snapshot.digest, destination, targetMappings, scorerMappings]))
    .digest('hex');

  // Work on a separate object: the signed source artifact must remain unchanged.
  const resolved: DatasetSnapshot = structuredClone(snapshot);
  resolved.configuration.name = destination.name;
  if (resolved.configuration.targetIds !== undefined) {
    resolved.configuration.targetIds = mapReferences(resolved.configuration.targetIds, targetMap);
  }
  if (resolved.configuration.scorerIds !== undefined) {
    resolved.configuration.scorerIds = mapReferences(resolved.configuration.scorerIds, scorerMap);
  }
  for (const item of resolved.items) {
    if (item.payload.scorerIds !== undefined) {
      item.payload.scorerIds = mapReferences(item.payload.scorerIds, scorerMap);
    }
  }
  // Resolved content is not a signed artifact: its references may differ from the source.
  // The byte budget applied to the source artifact above; mapped identifiers must not
  // turn an accepted artifact into a size failure.
  const { digest: _digest, ...unsigned } = resolved;
  const { digest: _resolvedDigest, ...content } = createDatasetSnapshot(unsigned, {
    maxBytes: Number.MAX_SAFE_INTEGER,
  });
  return {
    snapshot,
    content,
    destination,
    targetMappings,
    scorerMappings,
    requestFingerprint,
    receiptId: datasetSnapshotReceiptId({ ...destination, idempotencyKey: options.idempotencyKey }),
  };
}

export type PreparedDatasetSnapshotImport = ReturnType<typeof prepareDatasetSnapshotImport>;

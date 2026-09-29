import { z } from 'zod';

import type { ContainmentActionType } from '../../schemas/containment.js';
import { IncidentKindSchema } from '../../schemas/incident.js';

export const RUNBOOK_SCHEMA_VERSION = 1;
export const CHUNKING_ALGORITHM_VERSION = 1;
export const EMBEDDING_PROVIDER = 'fastembed';
export const EMBEDDING_MODEL = 'bge-small-en-v1.5';
export const EMBEDDING_DIMENSION = 384;

const RunbookIdSchema = z
  .string()
  .min(5)
  .max(64)
  .regex(/^RB-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u);
const RunbookOwnerSchema = z
  .string()
  .min(2)
  .max(128)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u);

export const RunbookFrontmatterSchema = z
  .object({
    id: RunbookIdSchema,
    version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u),
    incidentKinds: z.array(IncidentKindSchema).min(1).max(3),
    owner: RunbookOwnerSchema,
    status: z.enum(['active', 'inactive']),
    // These are the runbook's own mandatory statements, copied verbatim from
    // the procedure rather than represented as opaque rule identifiers.
    mandatoryRules: z.array(z.string().min(8).max(512)).min(1).max(8),
  })
  .strict()
  .refine(value => new Set(value.incidentKinds).size === value.incidentKinds.length);

export const RunbookChunkMetadataSchema = z
  .object({
    schemaVersion: z.literal(RUNBOOK_SCHEMA_VERSION),
    chunkingAlgorithmVersion: z.literal(CHUNKING_ALGORITHM_VERSION),
    chunkId: z.string().regex(/^rch_[0-9a-f]{64}$/u),
    vectorId: z.string().regex(/^rch_[0-9a-f]{64}$/u),
    runbookId: RunbookFrontmatterSchema.shape.id,
    runbookVersion: RunbookFrontmatterSchema.shape.version,
    incidentKind: IncidentKindSchema,
    status: z.enum(['active', 'inactive']),
    owner: RunbookOwnerSchema,
    sourcePath: z.string().regex(/^runbooks\/[a-z0-9-]+\.md$/u),
    sectionKey: z.string().regex(/^[a-z0-9-]+$/u),
    sectionOrdinal: z.number().int().min(1).max(9),
    chunkOrdinal: z.number().int().nonnegative(),
    sourceHash: z.string().regex(/^[0-9a-f]{64}$/u),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
    metadataHash: z.string().regex(/^[0-9a-f]{64}$/u),
    generationId: z.string().min(1).max(128),
    indexName: z.string().regex(/^rb_[a-z0-9_]+$/u),
    embeddingProvider: z.literal(EMBEDDING_PROVIDER),
    embeddingModel: z.literal(EMBEDDING_MODEL),
    embeddingDimension: z.literal(EMBEDDING_DIMENSION),
    text: z.string().min(1).max(1_200),
  })
  .strict()
  .refine(value => value.chunkId === value.vectorId);

export type RunbookFrontmatter = z.infer<typeof RunbookFrontmatterSchema>;
export type RunbookChunkMetadata = z.infer<typeof RunbookChunkMetadataSchema>;
export type AllowedAction = ContainmentActionType;

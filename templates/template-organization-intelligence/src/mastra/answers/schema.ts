import { z } from 'zod';
import type { SourceStatus } from '../workspaces/source-index.js';

export const MAX_QUESTION_CHARACTERS = 4_000;
export const MAX_EVIDENCE_TOKENS = 6_000;
export const MAX_OUTPUT_CHARACTERS = 16_384;

const sourceStatusSchema = z.object({
  sourceId: z.string(),
  ready: z.boolean(),
  stale: z.boolean(),
  lastSuccessAt: z.string().nullable(),
  error: z.string().nullable(),
  records: z.number(),
});

export const citationSchema = z.object({
  recordId: z.string(),
  sourceId: z.string(),
  path: z.string(),
  title: z.string(),
  locator: z.string(),
  revision: z.string(),
  indexedAt: z.string(),
  url: z.string().url().optional(),
});
const validationFailureSchema = z.enum([
  'retrieval_failure',
  'output_limit',
  'provider_failure',
  'invalid_json',
  'invalid_status_or_draft',
  'invalid_citation',
  'missing_citation',
  'invalid_abstention',
  'incomplete_conflict',
]);

export const organizationAnswerSchema = z.object({
  status: z.enum([
    'answered',
    'insufficient_evidence',
    'conflicting_evidence',
    'clarification_required',
    'operational_error',
  ]),
  answer: z.string().max(MAX_OUTPUT_CHARACTERS),
  citations: z.array(citationSchema).max(6),
  sourceStatus: z.array(sourceStatusSchema),
  metadata: z.object({
    correlationId: z.string().uuid(),
    retrievalMs: z.number().nonnegative(),
    sourceIds: z.array(z.string()),
    validationFailure: validationFailureSchema.optional(),
  }),
});

export type OrganizationAnswer = z.infer<typeof organizationAnswerSchema>;

export type GroundedAnswerObservation = {
  answer: OrganizationAnswer;
  evidence: Array<{ recordId: string; locator: string; sourceId: string; content: string }>;
};

export type Evidence = z.infer<typeof citationSchema> & { excerpt: string };
export type ProcessorState = {
  searchQuery?: string;
  clarification?: string;
  contextualizationAttempted?: boolean;
  contextualizationUsage?: unknown;
  evidence?: Evidence[];
  sourceStatus?: SourceStatus[];
  promptSourceStatus?: SourceStatus[];
  correlationId?: string;
  retrievalMs?: number;
  rawText?: string;
  answerResult?: OrganizationAnswer;
  emittedResult?: boolean;
  operationalFailure?: boolean;
  validationFailure?: z.infer<typeof validationFailureSchema>;
  startedAt?: number;
  telemetryRecorded?: boolean;
  usageReported?: boolean;
  observationRecorded?: boolean;
  presentation?: 'studio' | 'structured';
};

export type GroundingOptions = {
  maxRetries?: number;
  modelTimeout?: { totalMs?: number; stepMs?: number; firstChunkMs?: number };
  onGroundedAnswer?: (observation: GroundedAnswerObservation) => void;
  onGroundedUsage?: (usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined) => void;
};

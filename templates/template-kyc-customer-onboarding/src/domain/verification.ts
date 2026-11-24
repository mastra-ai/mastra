import { z } from 'zod';

import { evidenceIdSchema, providerIdSchema, timestampSchema } from './identifiers.js';

export const verificationStatusSchema = z.enum(['VERIFIED', 'NOT_VERIFIED', 'INCONCLUSIVE', 'ERROR']);

export const verificationResultSchema = z
  .object({
    status: verificationStatusSchema,
    reasonCodes: z.array(z.string().min(1).max(100)).min(1),
    evidenceIds: z.array(evidenceIdSchema),
    providerId: providerIdSchema,
    providerVersion: z.string().min(1).max(64),
    completedAt: timestampSchema,
  })
  .strict();

export const watchlistCandidateSchema = z
  .object({
    candidateId: z.string().min(1).max(128),
    score: z.number().min(0).max(1),
    classification: z.enum(['POSSIBLE', 'STRONG_REVIEW']),
    topics: z.array(z.string().min(1).max(80)),
    datasets: z.array(z.string().min(1).max(120)),
    evidenceIds: z.array(evidenceIdSchema),
  })
  .strict();

export const screeningKindSchema = z.enum(['SANCTIONS', 'PEP']);
export const screeningStatusSchema = z.enum(['CLEAR', 'POSSIBLE_MATCH', 'STRONG_CANDIDATE', 'INCONCLUSIVE', 'ERROR']);

export const screeningResultSchema = z
  .object({
    kind: screeningKindSchema,
    status: screeningStatusSchema,
    candidates: z.array(watchlistCandidateSchema),
    reasonCodes: z.array(z.string().min(1).max(100)).min(1),
    providerId: providerIdSchema,
    providerVersion: z.string().min(1).max(64),
    completedAt: timestampSchema,
  })
  .strict();

export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ScreeningResult = z.infer<typeof screeningResultSchema>;
export type WatchlistCandidate = z.infer<typeof watchlistCandidateSchema>;

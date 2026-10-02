import type { RunbookChunkMetadata } from '../mastra/knowledge/schemas.js';
import type { EligibleGeneration } from './runbook-operations.js';

export type AuthoritativeChunk = Readonly<{
  metadata: RunbookChunkMetadata;
  text: string;
  contentHash: string;
  metadataHash: string;
}>;

export type PersistedRetrievalChunk = AuthoritativeChunk & Readonly<{ score: number; rank: number }>;

export type RetrievalScope = Readonly<{
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  correlationId: string;
  incidentKind: string;
  queryHash: string;
  threshold: number;
  topK: number;
}>;

export type PersistedSelection = Readonly<{
  retrievalId: string;
  generation: EligibleGeneration;
  citation: string;
  selectedAt: string;
  selectionIntegrityHash: string;
  attempt: number;
  leaseToken?: string;
  leaseExpiresAt?: string;
}>;

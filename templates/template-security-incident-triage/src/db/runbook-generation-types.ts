import type { IncidentKind } from '../schemas/incident.js';

export type EligibleGeneration = Readonly<{
  incidentKind: IncidentKind;
  runbookId: string;
  version: string;
  generationId: string;
  indexName: string;
  revision: number;
  chunkCount: number;
  aggregateHash: string;
  allowedActionsJson: string;
  mandatoryRulesJson: string;
  sourceHash: string;
}>;

export type CleanupGenerationInput = Readonly<{
  generationId: string;
  indexName: string;
  expectedChunkCount: number;
}>;

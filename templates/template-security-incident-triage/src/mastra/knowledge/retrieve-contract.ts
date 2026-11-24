import { z } from 'zod';

import { opaqueId } from '../../schemas/common.js';
import { IncidentKindSchema } from '../../schemas/incident.js';

export const RetrieveRunbookInputSchema = z
  .object({
    incidentId: opaqueId,
    tenantId: opaqueId,
    workflowRunId: opaqueId,
    correlationId: opaqueId,
    incidentKind: IncidentKindSchema,
    queryText: z.string().max(2_048),
  })
  .strict();

export type RetrieveRunbookInput = z.infer<typeof RetrieveRunbookInputSchema>;
export type RetrieveRunbookResult = Readonly<{
  retrievalId: string;
  runbookId: string;
  version: string;
  generationId: string;
  citation: string;
  chunkIds: readonly string[];
  duplicate: boolean;
}>;

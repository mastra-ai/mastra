import { createStep } from '@mastra/core/workflows';
import type { z } from 'zod';
import { draftInputSchema } from '../../vendor-risk-drafts/contracts.ts';
import { approvalOutputSchema } from './review.ts';
import { documentResultSchema } from '../../../contracts/completion.ts';
import { databaseUrl, runtimeRoot } from '../../../persistence/database.ts';
import { publishExport } from '../../../exports/publication.ts';
import type { DraftWorkflowOptions } from '../../vendor-risk-drafts/runtime.ts';
export function createExportStep(options: DraftWorkflowOptions) {
  return createStep({
    id: 'publish-approved-bundle',
    inputSchema: approvalOutputSchema,
    outputSchema: documentResultSchema,
    execute: async ({ inputData, getInitData }) => {
      const input = getInitData<z.infer<typeof draftInputSchema>>();
      const { path, manifest } = await publishExport(inputData.runId, {
        databaseUrl: options.databaseUrl ?? databaseUrl,
        runtimeRoot: options.runtimeRoot ?? runtimeRoot,
        evidenceRoot: input.evidenceRoot,
        manifestPath: input.manifestPath,
      });
      return { path, manifest };
    },
  });
}

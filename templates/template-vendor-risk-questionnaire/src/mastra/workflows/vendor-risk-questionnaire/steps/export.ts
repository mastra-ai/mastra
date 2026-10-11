import { createStep } from '@mastra/core/workflows';
import { draftInputSchema } from '../../vendor-risk-drafts/contracts.ts';
import { approvalOutputSchema } from './review.ts';
import { exportManifestSchema } from '../../../contracts/review.ts';
import { databaseUrl, runtimeRoot } from '../../../persistence/database.ts';
import { publishExport } from '../../../exports/publication.ts';
import type { DraftWorkflowOptions } from '../../vendor-risk-drafts/runtime.ts';
export function createExportStep(options: DraftWorkflowOptions) {
  return createStep({
    id: 'publish-approved-bundle',
    inputSchema: approvalOutputSchema,
    outputSchema: exportManifestSchema,
    execute: async ({ inputData, getInitData }) => {
      const input = draftInputSchema.parse(getInitData());
      return (
        await publishExport(inputData.runId, {
          databaseUrl: options.databaseUrl ?? databaseUrl,
          runtimeRoot: options.runtimeRoot ?? runtimeRoot,
          evidenceRoot: input.evidenceRoot,
          manifestPath: input.manifestPath,
        })
      ).manifest;
    },
  });
}

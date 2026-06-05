import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Clinic-aware patient lookup tool.
 *
 * Requires `clinicId` in requestContext — the tool throws if the value is
 * absent so that missing-tenant failures surface immediately instead of
 * silently hanging during dataset experiment runs.
 */
export const clinicLookupTool = createTool({
  id: 'clinic-lookup',
  description: 'Looks up patient records for the current clinic tenant. Requires a clinicId in requestContext.',
  inputSchema: z.object({
    patientId: z.string().describe('The patient ID to look up'),
  }),
  requestContextSchema: z.object({
    clinicId: z.string(),
  }),
  execute: async ({ patientId }, { requestContext }) => {
    const clinicId = requestContext?.get('clinicId') as string | undefined;

    if (!clinicId) {
      throw new Error(
        'clinicId is missing from requestContext. The tool cannot execute without tenant isolation.',
      );
    }

    return {
      clinicId,
      patientId,
      tenant: clinicId,
      status: 'success',
      record: {
        patientId,
        clinicId,
        lastVisit: '2026-06-01',
        diagnosis: 'routine checkup',
      },
    };
  },
});

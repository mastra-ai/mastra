// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteNoteInputSchema = z.object({
  note_id: z.string().uuid().describe('The ID of the note to delete. Example: "d1b66c4d-13f5-4489-8ce5-b4afd63dce36"'),
});

export const deleteNoteOutputSchema = z.object({
  note_id: z.string(),
  deleted: z.boolean(),
});

export function deleteNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_note',
    description: 'Delete or archive a note in Attio.',
    inputSchema: deleteNoteInputSchema,
    outputSchema: deleteNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/notes/delete-a-note
      await platformProxy.delete({
        endpoint: `/v2/notes/${input.note_id}`,
        retries: 3,
      });

      return {
        note_id: input.note_id,
        deleted: true,
      };
    },
  });
}

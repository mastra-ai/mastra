// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createNoteInputSchema = z.object({
  body: z.string().optional().describe('The note text content. Limited to 65,536 characters.'),
  timestamp: z
    .string()
    .describe(
      'The note timestamp in ISO 8601 UTC format (e.g., "2021-11-12T15:48:22Z") or Unix timestamp in milliseconds.',
    ),
  ownerId: z.string().optional().describe('The HubSpot owner ID associated with the note.'),
  attachmentIds: z.array(z.string()).optional().describe('IDs of attachments to associate with the note.'),
  association: z
    .object({
      objectType: z
        .enum(['contact', 'company', 'deal', 'ticket'])
        .describe('The type of object to associate the note with.'),
      objectId: z.string().describe('The ID of the record to associate the note with.'),
    })
    .describe('The association to a contact, company, deal, or ticket.'),
});

export const createNoteOutputSchema = z.object({
  id: z.string(),
  body: z.string().optional(),
  timestamp: z.string().optional(),
  ownerId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_note',
    description:
      'Create a HubSpot note with body, timestamp, owner, optional attachments, and an explicit association to a contact, company, deal, or ticket.',
    inputSchema: createNoteInputSchema,
    outputSchema: createNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {
        hs_timestamp: input.timestamp,
      };

      if (input.body) {
        properties['hs_note_body'] = input.body;
      }

      if (input.ownerId) {
        properties['hubspot_owner_id'] = input.ownerId;
      }

      if (input.attachmentIds && input.attachmentIds.length > 0) {
        properties['hs_attachment_ids'] = input.attachmentIds.join(';');
      }

      const associationTypeIds: Record<string, number> = {
        contact: 202,
        company: 190,
        deal: 214,
        ticket: 223,
      };

      const associations = [
        {
          to: {
            id: input.association.objectId,
          },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: associationTypeIds[input.association.objectType],
            },
          ],
        },
      ];

      // https://developers.hubspot.com/docs/reference/api/crm/engagements/notes
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/notes',
        data: {
          properties,
          associations,
        },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        body: data.properties?.['hs_note_body'] ?? undefined,
        timestamp: data.properties?.['hs_timestamp'] ?? undefined,
        ownerId: data.properties?.['hubspot_owner_id'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}

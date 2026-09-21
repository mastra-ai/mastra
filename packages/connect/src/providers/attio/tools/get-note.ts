// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getNoteInputSchema = z.object({
  note_id: z.string().describe('The ID of the note to retrieve. Example: "ff3f3bd4-40f4-4f80-8187-cd02385af424"'),
});

const NoteIdSchema = z.object({
  workspace_id: z.string(),
  note_id: z.string(),
});

const CreatedByActorSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
});

const MentionedUserSchema = z.object({
  type: z.string(),
  object: z.string().optional(),
  record_id: z.string().optional(),
  workspace_member_id: z.string().optional(),
});

const ProviderNoteSchema = z.object({
  id: NoteIdSchema,
  title: z.string().optional(),
  content: z.union([z.string(), z.object({}).passthrough()]).optional(),
  format: z.enum(['plaintext', 'blocks']).or(z.string()).optional(),
  parent_object: z.string().optional(),
  parent_record_id: z.string().optional(),
  meeting_id: z.string().nullable().optional(),
  created_by_actor: CreatedByActorSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  users_mentioned: z.array(MentionedUserSchema).optional(),
});

export const getNoteOutputSchema = z.object({
  id: NoteIdSchema,
  title: z.string().optional(),
  content: z.union([z.string(), z.object({}).passthrough()]).optional(),
  format: z.enum(['plaintext', 'blocks']).or(z.string()).optional(),
  parent_object: z.string().optional(),
  parent_record_id: z.string().optional(),
  meeting_id: z.string().optional(),
  created_by_actor: CreatedByActorSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  users_mentioned: z.array(MentionedUserSchema).optional(),
});

export function getNoteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_note',
    description: 'Retrieve a single note from Attio.',
    inputSchema: getNoteInputSchema,
    outputSchema: getNoteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getNoteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/endpoint-reference/notes/get-a-note
      const response = await platformProxy.get({
        endpoint: `/v2/notes/${input.note_id}`,
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Note with ID "${input.note_id}" was not found.`,
        });
      }

      const providerNote = ProviderNoteSchema.parse(response.data.data);

      return {
        id: providerNote.id,
        ...(providerNote.title !== undefined && { title: providerNote.title }),
        ...(providerNote.content !== undefined && { content: providerNote.content }),
        ...(providerNote.format !== undefined && { format: providerNote.format }),
        ...(providerNote.parent_object !== undefined && { parent_object: providerNote.parent_object }),
        ...(providerNote.parent_record_id !== undefined && { parent_record_id: providerNote.parent_record_id }),
        ...(providerNote.meeting_id !== undefined && {
          meeting_id: providerNote.meeting_id === null ? undefined : providerNote.meeting_id,
        }),
        ...(providerNote.created_by_actor !== undefined && { created_by_actor: providerNote.created_by_actor }),
        ...(providerNote.created_at !== undefined && { created_at: providerNote.created_at }),
        ...(providerNote.updated_at !== undefined && { updated_at: providerNote.updated_at }),
        ...(providerNote.users_mentioned !== undefined && { users_mentioned: providerNote.users_mentioned }),
      };
    },
  });
}

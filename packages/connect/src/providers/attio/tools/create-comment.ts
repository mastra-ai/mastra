// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AuthorInputSchema = z.object({
  type: z.literal('workspace-member').describe('The type of actor. Must be workspace-member.'),
  id: z.string().uuid().describe('The ID of the workspace member. Example: "641ecd33-0a48-4b7b-ba48-bbb7a649a8ee"'),
});

const RecordTargetSchema = z.object({
  object: z
    .string()
    .describe('The slug or ID of the object. Example: "people" or "30ff61f7-6b37-414e-8d6f-fb42f963e996"'),
  record_id: z.string().uuid().describe('The ID of the record. Example: "4c6ade84-19c7-4581-95aa-b1d5f4571c25"'),
});

const EntryTargetSchema = z.object({
  list: z.string().describe('The slug or ID of the list. Example: "39723680-f534-4fe7-ab80-c5278e20e37b"'),
  entry_id: z.string().uuid().describe('The ID of the entry. Example: "e9a7b33a-6dfc-483d-9a3b-fbc20068c162"'),
});

export const createCommentInputSchema = z
  .object({
    format: z.literal('plaintext').describe('The format of the comment content. Must be "plaintext".'),
    content: z
      .string()
      .describe('The content of the comment. Workspace members can be mentioned using their email address.'),
    author: AuthorInputSchema.describe('The workspace member who wrote this comment.'),
    thread_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        'If responding to an existing thread, the ID of that thread. Example: "aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2"',
      ),
    record: RecordTargetSchema.optional().describe(
      'Target record for the comment. Required if thread_id and entry are not provided.',
    ),
    entry: EntryTargetSchema.optional().describe(
      'Target list entry for the comment. Required if thread_id and record are not provided.',
    ),
    created_at: z
      .string()
      .optional()
      .describe('Optional ISO timestamp to backdate the comment. Defaults to current time.'),
  })
  .refine(
    data => {
      // Must have either thread_id, record, or entry
      return data.thread_id !== undefined || data.record !== undefined || data.entry !== undefined;
    },
    {
      message: 'Must provide either thread_id, record, or entry to specify the comment target.',
    },
  );

const CommentIdSchema = z.object({
  workspace_id: z.string().uuid(),
  comment_id: z.string().uuid(),
});

const ActorSchema = z.object({
  id: z.string().nullable(),
  type: z.enum(['api-token', 'workspace-member', 'system', 'app']).or(z.string()).nullable(),
});

const EntrySchema = z.object({
  entry_id: z.string().uuid(),
  list_id: z.string().uuid(),
});

const RecordSchema = z.object({
  record_id: z.string().uuid(),
  object_id: z.string().uuid(),
});

const ProviderCommentSchema = z.object({
  id: CommentIdSchema,
  thread_id: z.string().uuid(),
  content_plaintext: z.string(),
  entry: EntrySchema.nullable(),
  record: RecordSchema,
  resolved_at: z.string().nullable(),
  resolved_by: ActorSchema.nullable(),
  created_at: z.string(),
  author: ActorSchema.nullable(),
});

const ProviderResponseSchema = z.object({
  data: ProviderCommentSchema,
});

export const createCommentOutputSchema = z.object({
  id: z.object({
    workspace_id: z.string().uuid().describe('The ID of the workspace the comment belongs to.'),
    comment_id: z.string().uuid().describe('The ID of the comment.'),
  }),
  thread_id: z.string().uuid().describe('The ID of the thread the comment belongs to.'),
  content_plaintext: z.string().describe('The plaintext content of the comment.'),
  record: z
    .object({
      record_id: z.string().uuid().describe('The ID of the record the comment belongs to.'),
      object_id: z.string().uuid().describe('The ID of the object the record belongs to.'),
    })
    .describe('The record the comment belongs to.'),
  entry: z
    .object({
      entry_id: z.string().uuid().describe('The ID of the entry the comment belongs to.'),
      list_id: z.string().uuid().describe('The ID of the list the entry belongs to.'),
    })
    .nullable()
    .describe('The entry the comment belongs to, null for comments on records.'),
  resolved_at: z.string().nullable().describe('Whether the comment is resolved.'),
  resolved_by: z
    .object({
      id: z.string().nullable().describe('The ID of the actor who resolved this comment.'),
      type: z
        .enum(['api-token', 'workspace-member', 'system', 'app'])
        .or(z.string())
        .nullable()
        .describe('The type of actor who resolved this comment.'),
    })
    .nullable()
    .describe('The actor that resolved this comment.'),
  created_at: z.string().describe('When the comment was created.'),
  author: z
    .object({
      id: z.string().nullable().describe('The ID of the actor who wrote this comment.'),
      type: z
        .enum(['api-token', 'workspace-member', 'system', 'app'])
        .or(z.string())
        .nullable()
        .describe('The type of actor who wrote this comment.'),
    })
    .nullable()
    .describe('Who wrote this comment.'),
});

export function createCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_comment',
    description: 'Create a comment on a record or list entry in Attio.',
    inputSchema: createCommentInputSchema,
    outputSchema: createCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestData: Record<string, unknown> = {
        format: input.format,
        content: input.content,
        author: input.author,
      };

      if (input.created_at !== undefined) {
        requestData['created_at'] = input.created_at;
      }

      if (input.thread_id !== undefined) {
        requestData['thread_id'] = input.thread_id;
      }

      if (input.record !== undefined) {
        requestData['record'] = input.record;
      }

      if (input.entry !== undefined) {
        requestData['entry'] = input.entry;
      }

      // https://docs.attio.com/rest-api/endpoint-reference/comments/create-a-comment
      const response = await platformProxy.post({
        endpoint: '/v2/comments',
        data: { data: requestData },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const comment = providerResponse.data;

      return {
        id: {
          workspace_id: comment.id.workspace_id,
          comment_id: comment.id.comment_id,
        },
        thread_id: comment.thread_id,
        content_plaintext: comment.content_plaintext,
        record: {
          record_id: comment.record.record_id,
          object_id: comment.record.object_id,
        },
        entry: comment.entry,
        resolved_at: comment.resolved_at,
        resolved_by: comment.resolved_by,
        created_at: comment.created_at,
        author: comment.author,
      };
    },
  });
}

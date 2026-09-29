// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createBiteInputSchema = z.object({
  transcript_id: z.string().describe('ID of the transcript. Example: "abc123"'),
  start_time: z.number().describe('Start time of the bite in seconds. Example: 0'),
  end_time: z.number().describe('End time of the bite in seconds. Example: 5'),
  name: z.string().max(256).optional().describe('Name of the bite. Maximum length is 256 characters.'),
  media_type: z.enum(['video', 'audio']).optional().describe('Type of the bite, either "video" or "audio"'),
  privacies: z
    .array(z.enum(['public', 'team', 'participants']))
    .optional()
    .describe('Array specifying the visibility of the Soundbite.'),
  summary: z.string().max(500).optional().describe('Summary for the bite. Maximum length is 500 characters.'),
});

export const createBiteOutputSchema = z.object({
  id: z.string().optional(),
  transcript_id: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  name: z.string().optional(),
  thumbnail: z.string().optional(),
  preview: z.string().optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  user_id: z.string().optional(),
  summary_status: z.string().optional(),
  media_type: z.string().optional(),
  privacies: z.array(z.string()).optional(),
  created_at: z.string().optional(),
});

const RawBiteSchema = z
  .object({
    id: z.string().optional(),
    transcript_id: z.string().optional(),
    start_time: z.union([z.string(), z.number()]).optional(),
    end_time: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    thumbnail: z.string().nullable().optional(),
    preview: z.string().nullable().optional(),
    status: z.string().optional(),
    summary: z.string().nullable().optional(),
    user_id: z.string().nullable().optional(),
    summary_status: z.string().nullable().optional(),
    media_type: z.string().nullable().optional(),
    privacies: z.array(z.string()).nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  data: z
    .object({
      createBite: RawBiteSchema,
    })
    .optional(),
});

export function createBiteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_create_bite',
    description: 'Create a soundbite clip from a transcript segment',
    inputSchema: createBiteInputSchema,
    outputSchema: createBiteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBiteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const formatString = (value: string): string => JSON.stringify(value);
      const formatNumber = (value: number): string => String(value);
      const formatStringArray = (value: string[]): string => `[${value.map(formatString).join(',')}]`;

      const args: string[] = [
        `transcript_Id: ${formatString(input.transcript_id)}`,
        `start_time: ${formatNumber(input.start_time)}`,
        `end_time: ${formatNumber(input.end_time)}`,
      ];

      if (input.name !== undefined) {
        args.push(`name: ${formatString(input.name)}`);
      }

      if (input.media_type !== undefined) {
        args.push(`media_type: ${formatString(input.media_type)}`);
      }

      if (input.privacies !== undefined) {
        args.push(`privacies: ${formatStringArray(input.privacies)}`);
      }

      if (input.summary !== undefined) {
        args.push(`summary: ${formatString(input.summary)}`);
      }

      const query = `
            mutation {
                createBite(${args.join(',')}) {
                    id
                    transcript_id
                    start_time
                    end_time
                    name
                    thumbnail
                    preview
                    status
                    summary
                    user_id
                    summary_status
                    media_type
                    privacies
                    created_at
                }
            }
        `;

      // https://docs.fireflies.ai/graphql-api/mutation/create-bite
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success || !parsed.data.data?.createBite) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Failed to create bite',
          details: parsed.error?.message || 'Unknown error',
        });
      }

      const raw = parsed.data.data.createBite;

      return {
        ...(raw.id !== undefined && { id: raw.id }),
        ...(raw.transcript_id !== undefined && { transcript_id: raw.transcript_id }),
        ...(raw.start_time !== undefined && {
          start_time: typeof raw.start_time === 'number' ? String(raw.start_time) : raw.start_time,
        }),
        ...(raw.end_time !== undefined && {
          end_time: typeof raw.end_time === 'number' ? String(raw.end_time) : raw.end_time,
        }),
        ...(raw.name !== undefined && { name: raw.name }),
        ...(raw.thumbnail != null && { thumbnail: raw.thumbnail }),
        ...(raw.preview != null && { preview: raw.preview }),
        ...(raw.status !== undefined && { status: raw.status }),
        ...(raw.summary != null && { summary: raw.summary }),
        ...(raw.user_id != null && { user_id: raw.user_id }),
        ...(raw.summary_status != null && { summary_status: raw.summary_status }),
        ...(raw.media_type != null && { media_type: raw.media_type }),
        ...(raw.privacies != null && { privacies: raw.privacies }),
        ...(raw.created_at !== undefined && { created_at: raw.created_at }),
      };
    },
  });
}

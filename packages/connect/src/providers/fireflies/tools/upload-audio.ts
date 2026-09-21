// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AttendeeSchema = z.object({
  displayName: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
});

const DownloadAuthSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bearer_token'),
    bearer: z.object({ token: z.string() }),
  }),
  z.object({
    type: z.literal('basic_auth'),
    basic: z.object({ username: z.string().optional(), password: z.string() }),
  }),
]);

export const uploadAudioInputSchema = z.object({
  url: z.string().describe('The URL of the media file to be transcribed. Example: "https://example.com/audio.mp3"'),
  title: z.string().optional().describe('Title or name of the meeting. Example: "Weekly sync"'),
  attendees: z.array(AttendeeSchema).optional(),
  webhook: z.string().optional(),
  custom_language: z.string().optional(),
  client_reference_id: z.string().optional(),
  save_video: z.boolean().optional(),
  bypass_size_check: z.boolean().optional(),
  download_auth: DownloadAuthSchema.optional(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      uploadAudio: z.object({
        success: z.boolean(),
        title: z.string().nullable().optional(),
        message: z.string().nullable().optional(),
      }),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        code: z.string().optional(),
        friendly: z.boolean().optional(),
        extensions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export const uploadAudioOutputSchema = z.object({
  success: z.boolean(),
  title: z.string().optional(),
  message: z.string().optional(),
});

export function uploadAudioTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_upload_audio',
    description: 'Submit an audio file URL for transcription.',
    inputSchema: uploadAudioInputSchema,
    outputSchema: uploadAudioOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof uploadAudioOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const variables = {
        input: {
          url: input.url,
          ...(input.title !== undefined && { title: input.title }),
          ...(input.attendees !== undefined && { attendees: input.attendees }),
          ...(input.webhook !== undefined && { webhook: input.webhook }),
          ...(input.custom_language !== undefined && { custom_language: input.custom_language }),
          ...(input.client_reference_id !== undefined && { client_reference_id: input.client_reference_id }),
          ...(input.save_video !== undefined && { save_video: input.save_video }),
          ...(input.bypass_size_check !== undefined && { bypass_size_check: input.bypass_size_check }),
          ...(input.download_auth !== undefined && { download_auth: input.download_auth }),
        },
      };

      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/mutation/upload-audio
        endpoint: '/graphql',
        data: {
          query: 'mutation($input: AudioUploadInput) { uploadAudio(input: $input) { success title message } }',
          variables,
        },
        retries: 1,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        const firstError = parsed.errors[0]!;
        throw new platformProxy.ActionError({
          type: firstError.code || 'graphql_error',
          message: firstError.message,
        });
      }

      if (!parsed.data?.uploadAudio) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Missing uploadAudio in provider response',
        });
      }

      const result = parsed.data.uploadAudio;

      return {
        success: result.success,
        ...(result.title != null && { title: result.title }),
        ...(result.message != null && { message: result.message }),
      };
    },
  });
}

// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cloneVoiceInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the new voice, shown in the ElevenLabs voice library.'),
  samples: z
    .array(
      z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Samples must be base64-encoded, without a data: URL prefix.'),
    )
    .min(1)
    .max(25)
    .describe(
      'Recordings of the voice to clone, each base64-encoded. One to two minutes of clean speech in total works best.',
    ),
  sample_format: z
    .string()
    .regex(/^[a-z0-9]{1,5}$/, 'Sample format is a file extension such as mp3, wav, ogg, or m4a.')
    .optional()
    .describe('File extension of every sample, for example mp3, wav, ogg, or m4a. Defaults to mp3.'),
  description: z.string().max(500).optional().describe('Description of the voice.'),
  labels: z
    .record(z.string(), z.string())
    .optional()
    .describe('Labels describing the voice, for example { "accent": "british", "gender": "female" }.'),
  remove_background_noise: z
    .boolean()
    .optional()
    .describe('Remove background noise from the samples before cloning. Can lower quality on clean recordings.'),
});

const ProviderClonedVoiceSchema = z
  .object({ voice_id: z.string(), requires_verification: z.boolean().optional() })
  .passthrough();

export const cloneVoiceOutputSchema = z.object({
  voice_id: z.string().describe('ID of the new voice. Pass it to elevenlabs_text_to_speech.'),
  requires_verification: z
    .boolean()
    .describe('True when ElevenLabs needs the voice owner to verify the clone before it can be used.'),
});

function formField(boundary: string, name: string, value: string): Buffer {
  return Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
}

export function cloneVoiceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_clone_voice',
    description:
      "Create an instant voice clone from recordings of a person's voice and add it to the voice library. Only clone a voice with its owner's consent.",
    inputSchema: cloneVoiceInputSchema,
    outputSchema: cloneVoiceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cloneVoiceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);

      // A random boundary per request keeps audio bytes from being read as another form part.
      const boundary = `----MastraElevenlabsCloneVoice${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
      const parts: Buffer[] = [formField(boundary, 'name', input.name)];
      if (input.description !== undefined) parts.push(formField(boundary, 'description', input.description));
      if (input.labels !== undefined) parts.push(formField(boundary, 'labels', JSON.stringify(input.labels)));
      if (input.remove_background_noise !== undefined) {
        parts.push(formField(boundary, 'remove_background_noise', String(input.remove_background_noise)));
      }
      input.samples.forEach((sample, index) => {
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="sample-${index + 1}.${input.sample_format ?? 'mp3'}"\r\n` +
              'Content-Type: application/octet-stream\r\n\r\n',
          ),
          Buffer.from(sample, 'base64'),
          Buffer.from('\r\n'),
        );
      });
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/voices/ivc/create
        endpoint: '/v1/voices/add',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        data: Buffer.concat(parts),
      });

      const voice = ProviderClonedVoiceSchema.parse(response.data);
      return { voice_id: voice.voice_id, requires_verification: voice.requires_verification ?? false };
    },
  });
}

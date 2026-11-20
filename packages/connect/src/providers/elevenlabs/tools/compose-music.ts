// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MEDIA_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  pcm: 'audio/pcm',
  ulaw: 'audio/basic',
  alaw: 'audio/x-alaw-basic',
};

export const composeMusicInputSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(4100)
      .optional()
      .describe(
        'Description of the song: genre, mood, instruments, structure, lyrics. Provide exactly one of prompt or composition_plan.',
      ),
    composition_plan: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'A plan from elevenlabs_create_composition_plan, edited or unchanged. Provide exactly one of prompt or composition_plan.',
      ),
    music_length_ms: z
      .number()
      .int()
      .min(3_000)
      .max(600_000)
      .optional()
      .describe('Length of the song in milliseconds, with prompt only. Chosen from the prompt when omitted.'),
    force_instrumental: z
      .boolean()
      .optional()
      .describe('Guarantee the song has no vocals, with prompt only. Defaults to false.'),
    model_id: z
      .string()
      .regex(/^music_v[0-9_]+$/, 'Music model IDs look like music_v1 or music_v2.')
      .optional()
      .describe('Music model, for example music_v1 or music_v2. Defaults to music_v1.'),
    output_format: z
      .string()
      .regex(
        /^(mp3|pcm|ulaw|alaw|opus|wav)_\d+(_\d+)?$/,
        'Output formats look like codec_sampleRate_bitrate, for example mp3_44100_128.',
      )
      .optional()
      .describe(
        'Audio format as codec_sampleRate_bitrate, for example mp3_44100_128. ElevenLabs picks the best format for the model when omitted.',
      ),
    seed: z.number().int().min(0).max(2_147_483_647).optional().describe('Seed for more repeatable output.'),
  })
  .refine(input => (input.prompt === undefined) !== (input.composition_plan === undefined), {
    message: 'Provide exactly one of prompt or composition_plan.',
    path: ['prompt'],
  })
  .refine(
    input =>
      input.composition_plan === undefined ||
      (input.music_length_ms === undefined && input.force_instrumental === undefined),
    {
      message: 'music_length_ms and force_instrumental only apply with prompt; set them in the plan instead.',
      path: ['composition_plan'],
    },
  );

export const composeMusicOutputSchema = z.object({
  audio: z.string().describe('The generated song, base64-encoded.'),
  media_type: z.string().describe('MIME type of the audio. Example: "audio/mpeg"'),
  size_bytes: z.number().describe('Size of the decoded audio in bytes.'),
});

type ComposeMusicOutput = z.infer<typeof composeMusicOutputSchema>;

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] || undefined;
}

/** Keeps the audio bytes out of the model's context; the full result still reaches the caller. */
function toComposeMusicModelOutput(output: ComposeMusicOutput) {
  const kilobytes = Math.max(1, Math.round(output.size_bytes / 1024));
  return { type: 'text' as const, value: `Composed ${kilobytes} KB of ${output.media_type} audio.` };
}

export function composeMusicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_compose_music',
    description:
      'Compose a song with Eleven Music from a prompt or a composition plan. Returns the audio base64-encoded; the model only sees a summary of it. Uses credits.',
    inputSchema: composeMusicInputSchema,
    outputSchema: composeMusicOutputSchema,
    toModelOutput: toComposeMusicModelOutput,
    execute: async (input, { requestContext }): Promise<ComposeMusicOutput> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post<ArrayBuffer>({
        // https://elevenlabs.io/docs/api-reference/music/compose
        endpoint: '/v1/music',
        ...(input.output_format !== undefined && { params: { output_format: input.output_format } }),
        data: {
          ...(input.prompt !== undefined && { prompt: input.prompt }),
          ...(input.composition_plan !== undefined && { composition_plan: input.composition_plan }),
          ...(input.music_length_ms !== undefined && { music_length_ms: input.music_length_ms }),
          ...(input.force_instrumental !== undefined && { force_instrumental: input.force_instrumental }),
          ...(input.model_id !== undefined && { model_id: input.model_id }),
          ...(input.seed !== undefined && { seed: input.seed }),
        },
        responseType: 'arraybuffer',
      });

      const audio = Buffer.from(response.data);
      const contentType = headerValue(response.headers, 'content-type')?.split(';')[0]?.trim();
      const codec = input.output_format?.split('_')[0] ?? 'mp3';
      return {
        audio: audio.toString('base64'),
        media_type: contentType?.startsWith('audio/')
          ? contentType
          : (MEDIA_TYPES[codec] ?? 'application/octet-stream'),
        size_bytes: audio.length,
      };
    },
  });
}

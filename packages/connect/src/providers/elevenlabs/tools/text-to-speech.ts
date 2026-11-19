// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

const MEDIA_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  pcm: 'audio/pcm',
  ulaw: 'audio/basic',
  alaw: 'audio/x-alaw-basic',
};

export const textToSpeechInputSchema = z.object({
  voice_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'Voice IDs contain only letters, digits, underscores, and hyphens.')
    .describe('The voice to speak with. Get voice IDs from elevenlabs_list_voices. Example: "JBFqnCBsd6RMkjVDRZzb"'),
  text: z.string().min(1).describe('The text to convert to speech.'),
  model_id: z
    .string()
    .optional()
    .describe(
      'The text-to-speech model. Get model IDs from elevenlabs_list_models (models with can_do_text_to_speech). Defaults to eleven_multilingual_v2.',
    ),
  output_format: z
    .string()
    .regex(
      /^(mp3|pcm|ulaw|alaw|opus|wav)_\d+(_\d+)?$/,
      'Output formats look like codec_sampleRate_bitrate, for example mp3_44100_128.',
    )
    .optional()
    .describe(
      'Audio format as codec_sampleRate_bitrate, for example mp3_44100_128 (the default), mp3_22050_32, pcm_16000, ulaw_8000, or opus_48000_64. Some formats need a higher subscription tier.',
    ),
  language_code: z
    .string()
    .optional()
    .describe('ISO 639-1 language code to enforce, for example "en". Only some models support it.'),
  voice_settings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarity_boost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      use_speaker_boost: z.boolean().optional(),
      speed: z.number().min(0.7).max(1.2).optional(),
    })
    .optional()
    .describe("Overrides the voice's stored settings for this request only."),
  seed: z
    .number()
    .int()
    .min(0)
    .max(4_294_967_295)
    .optional()
    .describe(
      'Seed for more repeatable output. The same seed and inputs usually, but not always, produce the same audio.',
    ),
});

export const textToSpeechOutputSchema = z.object({
  audio: z.string().describe('The generated audio, base64-encoded.'),
  media_type: z.string().describe('MIME type of the audio. Example: "audio/mpeg"'),
  output_format: z.string().describe('The ElevenLabs output format of the audio. Example: "mp3_44100_128"'),
  size_bytes: z.number().describe('Size of the decoded audio in bytes.'),
  history_item_id: z
    .string()
    .optional()
    .describe('ID of the history item ElevenLabs saved for this generation, when the response reports it.'),
});

type TextToSpeechOutput = z.infer<typeof textToSpeechOutputSchema>;

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] || undefined;
}

/** Keeps the audio bytes out of the model's context; the full result still reaches the caller. */
function toTextToSpeechModelOutput(output: TextToSpeechOutput) {
  const kilobytes = Math.max(1, Math.round(output.size_bytes / 1024));
  const historyItem = output.history_item_id ? ` History item: ${output.history_item_id}.` : '';
  return {
    type: 'text' as const,
    value: `Generated ${kilobytes} KB of ${output.media_type} audio (${output.output_format}).${historyItem}`,
  };
}

export function textToSpeechTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_text_to_speech',
    description:
      'Convert text to speech with an ElevenLabs voice. Returns the audio base64-encoded; the model only sees a summary of it. Uses character credits.',
    inputSchema: textToSpeechInputSchema,
    outputSchema: textToSpeechOutputSchema,
    toModelOutput: toTextToSpeechModelOutput,
    execute: async (input, { requestContext }): Promise<TextToSpeechOutput> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const outputFormat = input.output_format ?? DEFAULT_OUTPUT_FORMAT;

      const response = await platformProxy.post<ArrayBuffer>({
        // https://elevenlabs.io/docs/api-reference/text-to-speech/convert
        endpoint: `/v1/text-to-speech/${encodeURIComponent(input.voice_id)}`,
        params: { output_format: outputFormat },
        data: {
          text: input.text,
          ...(input.model_id !== undefined && { model_id: input.model_id }),
          ...(input.language_code !== undefined && { language_code: input.language_code }),
          ...(input.voice_settings !== undefined && { voice_settings: input.voice_settings }),
          ...(input.seed !== undefined && { seed: input.seed }),
        },
        responseType: 'arraybuffer',
      });

      const audio = Buffer.from(response.data);
      const contentType = headerValue(response.headers, 'content-type')?.split(';')[0]?.trim();
      const codec = outputFormat.split('_')[0]!;
      const historyItemId = headerValue(response.headers, 'history-item-id');

      return {
        audio: audio.toString('base64'),
        media_type: contentType?.startsWith('audio/')
          ? contentType
          : (MEDIA_TYPES[codec] ?? 'application/octet-stream'),
        output_format: outputFormat,
        size_bytes: audio.length,
        ...(historyItemId && { history_item_id: historyItemId }),
      };
    },
  });
}

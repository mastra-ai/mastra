// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DEFAULT_MODEL_ID = 'scribe_v2';

export const speechToTextInputSchema = z
  .object({
    audio: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Audio must be base64-encoded, without a data: URL prefix.')
      .optional()
      .describe('The audio or video to transcribe, base64-encoded. Provide exactly one of audio or source_url.'),
    audio_format: z
      .string()
      .regex(/^[a-z0-9]{1,5}$/, 'Audio format is a file extension such as mp3, wav, ogg, m4a, or mp4.')
      .optional()
      .describe('File extension of the base64 audio, for example mp3, wav, ogg, m4a, or mp4. Defaults to mp3.'),
    source_url: z
      .string()
      .regex(/^https?:\/\/\S+$/, 'Source URL must be an http(s) URL without whitespace.')
      .optional()
      .describe(
        'URL of hosted audio or video for ElevenLabs to fetch and transcribe, including YouTube and TikTok links. Provide exactly one of audio or source_url.',
      ),
    model_id: z
      .string()
      .regex(/^[a-z0-9_]+$/, 'Model IDs contain only lowercase letters, digits, and underscores.')
      .optional()
      .describe('Speech-to-text model ID. Defaults to scribe_v2.'),
    language_code: z
      .string()
      .regex(/^[A-Za-z]{2,3}$/, 'Use an ISO 639-1 or ISO 639-3 language code.')
      .optional()
      .describe('ISO 639-1 or 639-3 language code of the audio, for example "en" or "eng". Detected when omitted.'),
    tag_audio_events: z
      .boolean()
      .optional()
      .describe('Tag non-speech sounds such as (laughter) or (applause) in the transcript. Defaults to true.'),
    diarize: z.boolean().optional().describe('Label which speaker said each word. Defaults to false.'),
    num_speakers: z
      .number()
      .int()
      .min(1)
      .max(32)
      .optional()
      .describe('Maximum number of speakers in the audio, which helps diarization. Detected when omitted.'),
    include_words: z
      .boolean()
      .optional()
      .describe('Return word-level timings and speaker IDs in words. Defaults to false; long audio has many words.'),
  })
  .refine(input => (input.audio === undefined) !== (input.source_url === undefined), {
    message: 'Provide exactly one of audio or source_url.',
    path: ['audio'],
  });

const ProviderWordSchema = z
  .object({
    text: z.string(),
    start: z.number().nullable().optional(),
    end: z.number().nullable().optional(),
    type: z.string().optional(),
    speaker_id: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderTranscriptSchema = z
  .object({
    text: z.string(),
    language_code: z.string().nullable().optional(),
    language_probability: z.number().nullable().optional(),
    transcription_id: z.string().nullable().optional(),
    words: z.array(ProviderWordSchema).optional(),
  })
  .passthrough();

const WordSchema = z.object({
  text: z.string(),
  start: z.number().optional().describe('Start time in seconds.'),
  end: z.number().optional().describe('End time in seconds.'),
  type: z.string().optional().describe('word, spacing, or audio_event.'),
  speaker_id: z.string().optional().describe('Speaker label when diarize is true. Example: "speaker_0"'),
});

export const speechToTextOutputSchema = z.object({
  text: z.string().describe('The full transcript.'),
  language_code: z.string().optional().describe('Detected or requested language code. Example: "eng"'),
  language_probability: z.number().optional().describe('Confidence in the detected language, from 0 to 1.'),
  transcription_id: z.string().optional(),
  words: z.array(WordSchema).optional().describe('Word-level timings, returned when include_words is true.'),
});

function formField(boundary: string, name: string, value: string): Buffer {
  return Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
}

export function speechToTextTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_speech_to_text',
    description:
      'Transcribe audio or video with ElevenLabs Scribe, from base64 audio or a URL. Can tag sound events and label speakers. Uses transcription credits.',
    inputSchema: speechToTextInputSchema,
    outputSchema: speechToTextOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof speechToTextOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);

      // A random boundary per request keeps audio bytes from being read as another form part.
      const boundary = `----MastraElevenlabsSpeechToText${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
      const parts: Buffer[] = [formField(boundary, 'model_id', input.model_id ?? DEFAULT_MODEL_ID)];
      if (input.language_code !== undefined) parts.push(formField(boundary, 'language_code', input.language_code));
      if (input.tag_audio_events !== undefined) {
        parts.push(formField(boundary, 'tag_audio_events', String(input.tag_audio_events)));
      }
      if (input.diarize !== undefined) parts.push(formField(boundary, 'diarize', String(input.diarize)));
      if (input.num_speakers !== undefined) parts.push(formField(boundary, 'num_speakers', String(input.num_speakers)));
      if (input.source_url !== undefined) parts.push(formField(boundary, 'source_url', input.source_url));
      if (input.audio !== undefined) {
        parts.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${input.audio_format ?? 'mp3'}"\r\n` +
              'Content-Type: application/octet-stream\r\n\r\n',
          ),
          Buffer.from(input.audio, 'base64'),
          Buffer.from('\r\n'),
        );
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/speech-to-text/convert
        endpoint: '/v1/speech-to-text',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        data: Buffer.concat(parts),
      });

      const transcript = ProviderTranscriptSchema.parse(response.data);
      return {
        text: transcript.text,
        ...(transcript.language_code != null && { language_code: transcript.language_code }),
        ...(transcript.language_probability != null && { language_probability: transcript.language_probability }),
        ...(transcript.transcription_id != null && { transcription_id: transcript.transcription_id }),
        ...(input.include_words &&
          transcript.words && {
            words: transcript.words.map(word => ({
              text: word.text,
              ...(word.start != null && { start: word.start }),
              ...(word.end != null && { end: word.end }),
              ...(word.type !== undefined && { type: word.type }),
              ...(word.speaker_id != null && { speaker_id: word.speaker_id }),
            })),
          }),
      };
    },
  });
}

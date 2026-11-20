// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCompositionPlanInputSchema = z.object({
  prompt: z.string().min(1).max(4100).describe('Description of the song: genre, mood, instruments, structure, lyrics.'),
  music_length_ms: z
    .number()
    .int()
    .min(3_000)
    .max(600_000)
    .optional()
    .describe('Target length of the song in milliseconds. Chosen from the prompt when omitted.'),
  model_id: z
    .string()
    .regex(/^music_v[0-9_]+$/, 'Music model IDs look like music_v1 or music_v2.')
    .optional()
    .describe('Music model the plan is for, for example music_v1 or music_v2. Defaults to music_v1.'),
});

export const createCompositionPlanOutputSchema = z.object({
  composition_plan: z
    .record(z.string(), z.unknown())
    .describe(
      'The song plan: global styles plus sections with their own styles, durations, and lyrics. Edit it and pass it to elevenlabs_compose_music as composition_plan.',
    ),
});

export function createCompositionPlanTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_create_composition_plan',
    description:
      'Draft a section-by-section plan for a song from a prompt, without generating audio. Free, but rate limited. Edit the plan, then compose it with elevenlabs_compose_music.',
    inputSchema: createCompositionPlanInputSchema,
    outputSchema: createCompositionPlanOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCompositionPlanOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/api-reference/music/create-composition-plan
        endpoint: '/v1/music/plan',
        data: {
          prompt: input.prompt,
          ...(input.music_length_ms !== undefined && { music_length_ms: input.music_length_ms }),
          ...(input.model_id !== undefined && { model_id: input.model_id }),
        },
      });
      return { composition_plan: z.record(z.string(), z.unknown()).parse(response.data) };
    },
  });
}

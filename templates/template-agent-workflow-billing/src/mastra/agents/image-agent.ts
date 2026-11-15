import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { imageOutputSchema } from '../../images/schemas.js';
import type { Artifact } from '../../images/schemas.js';

/** Image generation capability supplied by the application. */
export interface ImageGenerator {
  /** Generate the image requested by the current application operation. */
  generate(): Promise<Artifact>;
}

export function createImageAgent(environment: NodeJS.ProcessEnv, images: ImageGenerator) {
  return new Agent({
    id: 'image-agent',
    name: 'Image Generation',
    instructions:
      'Generate the requested image using the generateImage tool exactly once. The tool uses the approved server-owned brief and configured image profile. Do not invent artifacts, paths or URLs. After the tool succeeds, give a short confirmation.',
    model: {
      id: 'openai/gpt-6-luna',
      api: 'responses',
      url: environment.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: environment.OPENAI_API_KEY,
    },
    maxRetries: 0,
    defaultOptions: { providerOptions: { openai: { reasoningEffort: 'none' } } },
    tools: {
      generateImage: createTool({
        id: 'generateImage',
        description: 'Generate the one image assigned to this execution slot.',
        inputSchema: z.strictObject({}),
        outputSchema: imageOutputSchema,
        execute: async () => ({ artifacts: [await images.generate()] as [Artifact] }),
      }),
    },
  });
}

import { createTool } from '@mastra/core/tools';
import { experimental_generateImage as generateImageAI } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'output', 'images');

export const generateImage = createTool({
  id: 'generate-image',
  description: 'Generate an educational image for a flash card concept using DALL-E 3. Saves the image locally.',
  inputSchema: z.object({
    concept: z.string().describe('The concept to visualize'),
    subjectArea: z.string().describe('The subject area (e.g., biology, physics, history)'),
  }),
  outputSchema: z.object({
    imagePath: z.string().describe('Local file path to the generated image'),
    revisedPrompt: z.string().describe('The prompt DALL-E actually used'),
  }),
  execute: async ({ concept, subjectArea }) => {
    const prompt = `Create a clear, educational diagram or illustration about "${concept}" in the subject of ${subjectArea}. The image should be suitable for a study flash card. Use clean visuals, labels where helpful, and no walls of text. Style: educational, clean, minimal.`;

    const { image } = await generateImageAI({
      model: openai.image('dall-e-3'),
      prompt,
      size: '1024x1024',
    });

    await mkdir(OUTPUT_DIR, { recursive: true });

    const filename = `${randomUUID()}.png`;
    const imagePath = join(OUTPUT_DIR, filename);

    await writeFile(imagePath, Buffer.from(image.base64, 'base64'));

    return {
      imagePath,
      revisedPrompt: prompt,
    };
  },
});

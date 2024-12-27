import { createTool } from '@mastra/core';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

import { stabilityai } from '../integrations/index.js';

export const imageTool = createTool({
  id: 'imageTool',
  name: 'imageTool',
  description: 'Generate an image based on a text prompt',
  inputSchema: z.object({
    directory: z.string(),
    prompt: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context: { directory, prompt } }) => {
    try {
      console.log('\n' + chalk.blue(`Generating image...`));
      const generateImageResult = await stabilityai.generateImage(prompt);
      const file = resolve(directory, generateImageResult.filename);

      writeFileSync(file, generateImageResult.buffer);

      console.log(chalk.blue(`Successfully generated: ${file}`));

      return {
        message: `Successfully created ${file}`,
      };
    } catch (e) {
      if (e instanceof Error) {
        console.log(`\n${chalk.red(e.message)}`);
        return { message: e.message };
      }
      return { message: 'Error' };
    }
  },
});

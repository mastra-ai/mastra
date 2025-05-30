import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger';
import { fromPackageRoot } from '../utils';

const examplesDir = fromPackageRoot('.docs/organized/code-examples');

// Helper function to list code examples
async function listCodeExamples(): Promise<Array<{ name: string; path: string }>> {
  void logger.debug('Listing code examples');
  try {
    const files = await fs.readdir(examplesDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace('.md', ''),
        path: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Helper function to read a code example
async function readCodeExample(filename: string): Promise<string> {
  const filePath = path.join(examplesDir, filename);
  void logger.debug(`Reading example: ${filename}`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    const examples = await listCodeExamples();
    const availableExamples = examples.map(ex => `- ${ex.name}`).join('\n');
    return `Example "${filename}" not found.\n\nAvailable examples:\n${availableExamples}`;
  }
}

// Get initial examples for the description
const initialExamples = await listCodeExamples();
const examplesListing =
  initialExamples.length > 0
    ? '\n\nAvailable examples: ' + initialExamples.map(ex => ex.name).join(', ')
    : '\n\nNo examples available yet. Run the documentation preparation script first.';

export const examplesInputSchema = z.object({
  example: z
    .string()
    .optional()
    .describe(
      'Name of the specific example to fetch. If not provided, lists all available examples.' + examplesListing,
    ),
});

export type ExamplesInput = z.infer<typeof examplesInputSchema>;

export const examplesTool = {
  name: 'mastraExamples',
  description:
    'Get code examples from the Mastra.ai examples directory. Without a specific example name, lists all available examples. With an example name, returns the full source code of that example.',
  parameters: examplesInputSchema,
  execute: async (args: ExamplesInput) => {
    void logger.debug('Executing mastraExamples tool', { example: args.example });
    try {
      if (!args.example) {
        const examples = await listCodeExamples();
        return ['Available code examples:', '', ...examples.map(ex => `- ${ex.name}`)].join('\n');
      }

      const filename = args.example.endsWith('.md') ? args.example : `${args.example}.md`;
      const result = await readCodeExample(filename);
      return result;
    } catch (error) {
      void logger.error('Failed to execute mastraExamples tool', error);
      throw error;
    }
  },
};

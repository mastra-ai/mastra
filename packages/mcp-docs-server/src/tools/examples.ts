import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

const examplesDir = fromPackageRoot('.docs/organized/code-examples');

// Helper function to list code examples
async function listCodeExamples(): Promise<Array<{ name: string; path: string }>> {
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

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    const examples = await listCodeExamples();
    const availableExamples = examples.map(ex => `- ${ex.name}`).join('\n');
    throw new Error(`Example "${filename}" not found.\n\nAvailable examples:\n${availableExamples}`);
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
  execute: async (args: ExamplesInput) => {
    try {
      if (!args.example) {
        const examples = await listCodeExamples();
        return {
          content: [
            {
              type: 'text',
              text: ['Available code examples:', '', ...examples.map(ex => `- ${ex.name}`)].join('\n'),
            },
          ],
          isError: false,
        };
      }

      const filename = args.example.endsWith('.md') ? args.example : `${args.example}.md`;
      const content = await readCodeExample(filename);
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};

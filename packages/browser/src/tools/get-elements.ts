import { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import type { LanguageModelV1 } from 'ai';
import { z } from 'zod';
import type { CollectedElement } from '../types';
import type { ToolContext } from './types';

type GetElementInput = {
  queries: string[];
  elements: CollectedElement[];
};

const DEFAULT_BATCH_SIZE = 250;

const inputSchema = z.object({
  queries: z.array(z.string()).describe('The user queries to find the correct elements'),
});

const outputSchema = z.union([
  z.object({
    elements: z.array(z.string()),
  }),
  z.object({
    message: z.string(),
  }),
]);

export function getElementsTool(
  { model, batchSize: CHUNK_SIZE = DEFAULT_BATCH_SIZE }: { model: LanguageModelV1; batchSize?: number },
  globalContext: ToolContext,
): Tool<typeof inputSchema, typeof outputSchema> {
  const cache = new Map<string, CollectedElement[]>();

  async function getElements(agent: Agent, { queries, elements }: GetElementInput) {
    if (elements.length === 0) {
      return [];
    }

    const prompt = `Give me the correct xpaths for the elements that matches the query, each query is divided by a |: ${queries.join('|')}

IMPORTANT: Only use xpaths you can find list below, do not make up your own xpaths.

list of XPaths with their text inputs:
${elements
  .map(el => {
    return `${el.xpaths}: ${el.output}`;
  })
  .join('\n')}`;

    const element = await agent.generate(prompt, {
      output: z.object({
        xpaths: z.array(z.string()),
      }),
    });

    return element.object.xpaths;
  }

  return createTool({
    id: 'get-elements',
    description: 'From an agent instruction, get the list of xpath elements to interact with on the current page.',
    inputSchema,
    outputSchema,
    // @ts-ignore
    execute: async ({ context, mastra }) => {
      try {
        if (!globalContext?.page) {
          return { message: 'Error: Page is not open, try the new-page tool first' };
        }

        const url = globalContext.page.url();
        if (!cache.has(url)) {
          const elements = await globalContext.page.evaluate(() => {
            // @ts-ignore
            return window.collectDomNodes(document.body);
          });

          cache.set(url, elements);
        }

        const elements = cache.get(url)!;

        const findElementSubAgent = new Agent({
          name: 'find-element',
          instructions:
            'Given a list of xpath and texts, based on the query, return the correct xpaths. Only use xpaths you can find in the instructions.',
          model,
        });

        if (mastra) {
          findElementSubAgent.__registerMastra(mastra as unknown as Mastra);
        }

        const allXpaths = new Set<string>();
        for (let i = 0; i < elements.length; i += CHUNK_SIZE) {
          const xpaths = await getElements(findElementSubAgent, {
            elements: elements.slice(i, i + CHUNK_SIZE),
            queries: context.queries,
          });

          if (xpaths) {
            xpaths.forEach(x => allXpaths.add(x));
          }
        }

        if (allXpaths.size === 0) {
          return { message: 'No elements found' };
        }

        return { elements: Array.from(allXpaths) };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error: ${e.message}`, found: false };
        }
        return { message: 'An unknown error occurred', found: false };
      }
    },
  });
}

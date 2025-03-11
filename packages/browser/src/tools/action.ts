import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolContext } from './types';

const inputSchema = z.object({
  actions: z.array(
    z.object({
      selector: z.string().describe('xPath selector of the element to do an action on'),
      action: z.enum(['click', 'type', 'submit', 'scroll', 'read', 'wait']),
      value: z.string().optional().describe('value to type if the action is type'),
    }),
  ),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      message: z.string(),
      content: z.string().optional(),
    }),
  ),
});

export function elementActionTool(globalContext: ToolContext): Tool<typeof inputSchema, typeof outputSchema> {
  return createTool({
    id: 'element-action',
    description: 'Performs an action on an element',
    inputSchema,
    outputSchema,
    execute: async ({ context }) => {
      try {
        if (!globalContext?.page) {
          return { results: [{ message: 'No page is currently open' }] };
        }

        const results: { message: string; content?: string }[] = [];

        // Process each action in the array
        for (const { selector, action, value } of context.actions) {
          // Find the element using the XPath selector
          const element = globalContext.page.locator(`xpath=${selector}`);

          if ((await element.count()) === 0) {
            results.push({ message: `Element with selector "${selector}" not found` });
            continue;
          }

          // Perform the requested action
          switch (action) {
            case 'click':
              await element.click();
              results.push({ message: `Successfully clicked element with selector "${selector}"` });
              break;
            case 'type':
              if (!value) {
                results.push({ message: 'Error: Value is required for type action' });
                break;
              }

              await element.fill(value);
              results.push({ message: `Successfully typed "${value}" into element with selector "${selector}"` });
              break;
            case 'submit':
              await element.press('Enter');
              results.push({ message: `Successfully submitted form with selector "${selector}"` });
              break;
            case 'scroll':
              await element.scrollIntoViewIfNeeded();
              results.push({ message: `Successfully scrolled to element with selector "${selector}"` });
              break;
            case 'read':
              const text = await element.textContent();
              results.push({
                message: `Successfully read content from element with selector "${selector}"`,
                content: text || '',
              });
              break;
            default:
              results.push({ message: `Unsupported action: ${action}` });
          }
        }

        return { results };
      } catch (e) {
        if (e instanceof Error) {
          return { results: [{ message: `Error: ${e.message}` }] };
        }
        return { results: [{ message: 'An unknown error occurred' }] };
      }
    },
  });
}

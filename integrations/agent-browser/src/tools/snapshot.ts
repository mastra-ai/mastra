import { createTool } from '@mastra/core/tools';
import type { BrowserManager } from 'agent-browser/dist/browser.js';
import { z } from 'zod';

import { createError } from '../errors.js';

/**
 * Input schema for the browser_snapshot tool.
 */
const snapshotInputSchema = z.object({
  interactiveOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only show interactive elements (buttons, links, inputs)'),
  maxElements: z.number().optional().default(50).describe('Maximum elements to return'),
});

/**
 * Output schema for the browser_snapshot tool.
 */
const snapshotOutputSchema = z.object({
  tree: z.string().describe('Formatted accessibility tree with refs'),
  elementCount: z.number().describe('Number of interactive elements found'),
  truncated: z.boolean().describe('Whether output was truncated due to maxElements'),
});

/**
 * Creates a snapshot tool that captures the page accessibility tree.
 *
 * The tool returns element refs (@e1, @e2) that can be used with click and type tools.
 * Output includes page context (URL, title) and a formatted tree showing the page structure.
 *
 * @param getBrowser - Async function that returns the BrowserManager instance
 * @returns A Mastra tool for capturing page snapshots
 */
export function createSnapshotTool(getBrowser: () => Promise<BrowserManager>) {
  return createTool({
    id: 'browser_snapshot',
    description:
      'Capture accessibility snapshot of the page. Returns element refs (@e1, @e2) for use with click and type tools.',
    inputSchema: snapshotInputSchema,
    outputSchema: snapshotOutputSchema,
    execute: async input => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        // Get enhanced snapshot from agent-browser (already has refs)
        const snapshot = await browser.getSnapshot({
          interactive: input.interactiveOnly,
          compact: true,
        });

        // Get page context
        const url = page.url();
        const title = await page.title();

        // Count refs from snapshot
        const elementCount = Object.keys(snapshot.refs).length;
        const maxElements = input.maxElements ?? 50;
        const truncated = elementCount > maxElements;

        // Build header with page context
        const headerParts = [`Page: ${title}`, `URL: ${url}`, `Interactive elements: ${elementCount}`];

        if (truncated) {
          headerParts[2] += ` (showing first ${maxElements})`;
        }

        const header = headerParts.join('\n') + '\n\n';

        // Transform tree refs from [ref=e1] format to @e1 format
        const formattedTree = snapshot.tree.replace(/\[ref=(\w+)\]/g, '@$1');

        return {
          tree: header + formattedTree,
          elementCount,
          truncated,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createError('browser_error', `Snapshot failed: ${message}`, 'Ensure the browser is launched and the page has loaded.');
      }
    },
  });
}

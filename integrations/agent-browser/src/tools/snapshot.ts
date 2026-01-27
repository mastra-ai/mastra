import { createTool } from '@mastra/core/tools';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

import { createError } from '../errors.js';
import { snapshotInputSchema, snapshotOutputSchema } from '../types.js';

/**
 * Maximum characters in the tree output to prevent context bloat.
 * ~8000 chars keeps snapshots manageable.
 */
const MAX_TREE_CHARS = 8000;

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

        // Get scroll position to help agent know if there's more content
        const scrollInfo = (await page.evaluate(`({
          scrollY: Math.round(window.scrollY),
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          atTop: window.scrollY < 50,
          atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 50
        })`)) as {
          scrollY: number;
          scrollHeight: number;
          viewportHeight: number;
          atTop: boolean;
          atBottom: boolean;
        };

        // Count refs from snapshot
        const elementCount = Object.keys(snapshot.refs).length;
        const maxElements = input.maxElements ?? 50;
        const truncated = elementCount > maxElements;

        // Transform tree refs from [ref=e1] format to @e1 format
        let formattedTree = snapshot.tree.replace(/\[ref=(\w+)\]/g, '@$1');

        // Actually filter tree to only include first maxElements refs
        // Find all ref patterns and only keep lines with refs up to maxElements
        if (truncated) {
          const refPattern = /@e(\d+)/g;
          const lines = formattedTree.split('\n');
          const filteredLines: string[] = [];
          const seenRefs = new Set<number>();

          for (const line of lines) {
            const matches = line.match(refPattern);
            if (matches) {
              // Check if any ref in this line exceeds maxElements
              let includeLineForRefs = true;
              for (const match of matches) {
                const refNum = parseInt(match.slice(2), 10);
                if (refNum > maxElements) {
                  includeLineForRefs = false;
                  break;
                }
                seenRefs.add(refNum);
              }
              if (includeLineForRefs) {
                filteredLines.push(line);
              }
            } else {
              // Lines without refs (headers, structure) - include if we haven't exceeded limit
              if (seenRefs.size <= maxElements) {
                filteredLines.push(line);
              }
            }

            // Stop if we've seen enough refs
            if (seenRefs.size >= maxElements) {
              break;
            }
          }

          formattedTree = filteredLines.join('\n');
        }

        // Build header with page context and scroll info
        const headerParts = [`Page: ${title}`, `URL: ${url}`, `Elements: ${Math.min(elementCount, maxElements)} of ${elementCount}`];

        // Add scroll position info
        const scrollPercent = Math.round((scrollInfo.scrollY / (scrollInfo.scrollHeight - scrollInfo.viewportHeight)) * 100) || 0;
        if (scrollInfo.atTop && !scrollInfo.atBottom) {
          headerParts.push(`Scroll: TOP - more content below, scroll down if needed`);
        } else if (scrollInfo.atBottom) {
          headerParts.push(`Scroll: BOTTOM of page`);
        } else {
          headerParts.push(`Scroll: ${scrollPercent}% down`);
        }

        if (truncated) {
          headerParts.push(`[Showing first ${maxElements} elements - use interactiveOnly:true to filter]`);
        }

        const header = headerParts.join('\n') + '\n\n';

        // Final character limit check
        let finalTree = header + formattedTree;
        let charTruncated = false;
        if (finalTree.length > MAX_TREE_CHARS) {
          finalTree = finalTree.slice(0, MAX_TREE_CHARS - 50) + '\n\n[... truncated]';
          charTruncated = true;
        }

        return {
          success: true,
          tree: finalTree,
          elementCount,
          truncated: truncated || charTruncated,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createError('browser_error', `Snapshot failed: ${message}`, 'Ensure the browser is launched and the page has loaded.');
      }
    },
  });
}

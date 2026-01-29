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
      'Capture accessibility snapshot of the page. Returns element refs (@e1, @e2) for use with click and type tools. By default shows only interactive elements — set interactiveOnly:false to see all page text content (required for reading/summarizing). Use offset to paginate (offset:50 shows elements 51-100).',
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

        // Count refs from snapshot (before filtering)
        const totalElementCount = Object.keys(snapshot.refs).length;
        const maxElements = input.maxElements ?? 50;
        const offset = input.offset ?? 0;

        // Transform tree refs from [ref=e1] format to @e1 format
        let formattedTree = snapshot.tree.replace(/\[ref=(\w+)\]/g, '@$1');

        // Filter out elements that clutter the output:
        // 1. "option" elements - agent uses browser_select anyway
        // 2. Keyboard shortcut helper links (e.g., "Add to cart, shift, option, K")
        const treeLines = formattedTree.split('\n');
        const filteredTreeLines = treeLines.filter(line => {
          const trimmed = line.trim();
          // Filter out option lines (e.g., "- option "All Departments" @e10")
          if (trimmed.startsWith('- option ')) return false;
          // Filter out keyboard shortcut helper links (Amazon-style: "Action, shift, option, X" or "Action, option, X")
          if (/, (shift, )?option, \w"/.test(line)) return false;
          return true;
        });
        formattedTree = filteredTreeLines.join('\n');

        // Recalculate element count after filtering options
        const remainingRefs = formattedTree.match(/@e\d+/g) || [];
        const filteredElementCount = new Set(remainingRefs).size;

        // Filter tree to include elements from offset to offset+maxElements
        // This enables pagination: offset:0 shows 1-50, offset:50 shows 51-100, etc.
        const refPattern = /@e(\d+)/g;
        const lines = formattedTree.split('\n');
        const filteredLines: string[] = [];
        let seenCount = 0;
        let includedCount = 0;

        for (const line of lines) {
          const matches = line.match(refPattern);
          if (matches) {
            // Get the first ref number on this line to determine if we should include it
            const firstRefNum = parseInt(matches[0].slice(2), 10);

            // Skip elements before offset, include elements from offset to offset+maxElements
            if (seenCount >= offset && includedCount < maxElements) {
              filteredLines.push(line);
              includedCount++;
            }
            seenCount++;
          } else {
            // Lines without refs (structural) - include if we're in the display range
            if (seenCount >= offset && includedCount < maxElements) {
              filteredLines.push(line);
            }
          }

          // Stop if we've included enough
          if (includedCount >= maxElements) {
            break;
          }
        }

        formattedTree = filteredLines.join('\n');
        const hasMore = seenCount > offset + maxElements || filteredElementCount > offset + maxElements;

        // Build header with page context and scroll info
        const startElement = offset + 1;
        const endElement = Math.min(offset + includedCount, filteredElementCount);
        const headerParts = [`Page: ${title}`, `URL: ${url}`, `Elements: ${startElement}-${endElement} of ${filteredElementCount} (options filtered)`];

        // Add scroll position info
        const scrollPercent = Math.round((scrollInfo.scrollY / (scrollInfo.scrollHeight - scrollInfo.viewportHeight)) * 100) || 0;
        if (scrollInfo.atTop && !scrollInfo.atBottom) {
          headerParts.push(`Scroll: TOP - more content below, scroll down if needed`);
        } else if (scrollInfo.atBottom) {
          headerParts.push(`Scroll: BOTTOM of page`);
        } else {
          headerParts.push(`Scroll: ${scrollPercent}% down`);
        }

        if (hasMore) {
          headerParts.push(`[More elements available - use offset:${offset + maxElements} to see next batch]`);
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
          elementCount: filteredElementCount,
          truncated: hasMore || charTruncated,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createError('browser_error', `Snapshot failed: ${message}`, 'Ensure the browser is launched and the page has loaded.');
      }
    },
  });
}

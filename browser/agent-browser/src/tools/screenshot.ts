/**
 * browser_screenshot - Capture a screenshot of the current page
 */

import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { screenshotInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';

export function createScreenshotTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.SCREENSHOT,
    description:
      'Capture a screenshot of the current viewport as a visible PNG (set fullPage: true for full-page capture). Use snapshot when you only need text or interactive elements — screenshots are expensive. Use this when you need to visually inspect the page, e.g. evaluating images, product photos, layout, design, or colors.',
    inputSchema: screenshotInputSchema,
    execute: async (input, { agent, workspace, requestContext }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      const result = await browser.screenshot(input, threadId);
      if (!input.path || !('base64' in result)) return result;

      try {
        // Workspaces can resolve their filesystem per request, so prefer the resolver. Core versions
        // before it existed (this package supports them) only have the static filesystem.
        const filesystem =
          typeof workspace?.resolveFilesystem === 'function'
            ? await workspace.resolveFilesystem({ requestContext: requestContext ?? new RequestContext() })
            : workspace?.filesystem;
        if (!filesystem) {
          return { ...result, saveError: 'There is no workspace filesystem to save the screenshot into.' };
        }
        await filesystem.writeFile(input.path, Buffer.from(result.base64, 'base64'), {
          recursive: true,
          mimeType: 'image/png',
        });
        return { ...result, path: input.path };
      } catch (error) {
        return { ...result, saveError: error instanceof Error ? error.message : String(error) };
      }
    },
    toModelOutput(output) {
      const result = output as {
        base64?: string;
        title?: string;
        url?: string;
        message?: string;
        path?: string;
        saveError?: string;
      };

      if (typeof result.base64 !== 'string') {
        return {
          type: 'content' as const,
          value: [{ type: 'text' as const, text: result.message ?? 'Failed to capture screenshot.' }],
        };
      }

      return {
        type: 'content' as const,
        value: [
          {
            type: 'media' as const,
            mediaType: 'image/png',
            data: result.base64,
          },
          ...(result.path ? [{ type: 'text' as const, text: `Saved to ${result.path}` }] : []),
          ...(result.saveError
            ? [{ type: 'text' as const, text: `Couldn't save the screenshot: ${result.saveError}` }]
            : []),
        ],
      };
    },
  });
}

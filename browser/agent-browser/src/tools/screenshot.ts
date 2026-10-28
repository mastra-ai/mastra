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
        const blocked = await writeBlocked(
          workspace!,
          filesystem.readOnly,
          // The same arguments the write-file tool's settings see; saving always overwrites.
          { path: input.path, overwrite: true },
          requestContext,
        );
        if (blocked) return { ...result, saveError: blocked };
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

const WRITE_FILE_TOOL = 'mastra_workspace_write_file';

type ConfigValue = boolean | ((context: Record<string, unknown>) => boolean | Promise<boolean>) | undefined;

/**
 * Saving a screenshot writes a file, so it follows the workspace's write-file settings: it's refused
 * when writing is turned off, the filesystem is read-only, or writes need approval (a screenshot
 * can't ask for it).
 */
async function writeBlocked(
  workspace: { getToolsConfig?: () => Record<string, any> | undefined },
  readOnly: boolean | undefined,
  args: Record<string, unknown>,
  requestContext: RequestContext | undefined,
): Promise<string | undefined> {
  if (readOnly) return 'The workspace filesystem is read-only.';
  const config = workspace.getToolsConfig?.();
  const perTool = config?.[WRITE_FILE_TOOL];
  const context = {
    args,
    requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
    workspace,
  };
  const resolve = async (value: ConfigValue, fallback: boolean, safeDefault: boolean) => {
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    try {
      return await value(context);
    } catch {
      return safeDefault;
    }
  };
  if (!(await resolve(perTool?.enabled ?? config?.enabled, true, false))) {
    return 'Writing files is turned off in this workspace.';
  }
  if (await resolve(perTool?.requireApproval ?? config?.requireApproval, false, true)) {
    return 'Writing files needs approval in this workspace, so the screenshot was not saved.';
  }
  return undefined;
}

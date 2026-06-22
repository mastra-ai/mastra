/**
 * plan_file tool — read/write plan files for the current resource.
 *
 * Plan files live outside the workspace sandbox (in the app data directory),
 * so the agent cannot access them with regular workspace tools. This tool
 * provides CRUD access to the current resource's plan file, letting the agent
 * read a previously submitted plan, update it with revisions, or delete it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { MastraCodeState } from '../schema.js';
import { getAppDataDir } from '../utils/project.js';

function getPlansDir(): string {
  return process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
}

function getPlanFilePath(resourceId: string): string {
  return path.join(getPlansDir(), resourceId, 'current-plan.md');
}

export const planFileTool = createTool({
  id: 'plan_file',
  description:
    'Read or update the plan file for the current resource. Plan files live outside the workspace sandbox, so you must use this tool to access them. Use "read" to retrieve the current plan before making revisions.',
  inputSchema: z.object({
    action: z
      .enum(['read', 'write', 'delete'])
      .describe(
        "'read' returns the current plan content, 'write' creates or overwrites the plan file, 'delete' removes it.",
      ),
    content: z.string().optional().describe("New plan content in markdown (required for 'write')."),
  }),
  execute: async ({ action, content }: { action: 'read' | 'write' | 'delete'; content?: string }, context: any) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
      const resourceId = harnessCtx?.resourceId;
      if (!resourceId) {
        return { content: 'Cannot determine resource ID for plan file access.', isError: true };
      }

      const filePath = getPlanFilePath(resourceId);

      switch (action) {
        case 'read': {
          try {
            const data = await fs.readFile(filePath, 'utf-8');
            return { content: data, isError: false };
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              return { content: 'No plan file exists yet for this resource.', isError: false };
            }
            throw err;
          }
        }

        case 'write': {
          if (!content) {
            return { content: "The 'content' parameter is required for the 'write' action.", isError: true };
          }
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(filePath, content, 'utf-8');
          return { content: `Plan file written to ${filePath}`, isError: false };
        }

        case 'delete': {
          try {
            await fs.unlink(filePath);
            return { content: `Plan file deleted: ${filePath}`, isError: false };
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              return { content: 'No plan file to delete.', isError: false };
            }
            throw err;
          }
        }

        default:
          return { content: `Unknown action: ${action}`, isError: true };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `plan_file failed: ${msg}`, isError: true };
    }
  },
} as any);

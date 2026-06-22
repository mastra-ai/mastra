import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
// Real server routes — the same objects `mastra dev` registers. We mount them
// on a real Hono app below, so scenarios exercise the production routing.
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { z } from 'zod';

import { mountHarnessRoutes } from '../../src/web/hono-routes.js';
import type { ServerRouteLike } from '../../src/web/hono-routes.js';

/**
 * In-process Mastra harness server for scenario tests.
 *
 * Builds a real {@link Harness} (model pointed at AIMock), registers it on a
 * real {@link Mastra}, then mounts the real `@mastra/server` harness routes on a
 * real Hono app. `app.fetch` is handed to the `@mastra/client-js` MastraClient,
 * so a scenario drives the full production stack:
 *
 *   MastraClient → Hono → @mastra/server route handlers → Harness session →
 *   AIMock model → SSE events back to the client.
 */

const HARNESS_ID = 'code';

export interface ScenarioServerOptions {
  /** Auto-approve all tool calls (default true). Set false to test approvals. */
  yolo?: boolean;
  /** Attach a real sandboxed workspace + file/shell tools to the agent. */
  workspace?: boolean;
}

export interface ScenarioServer {
  /** Pass to `new MastraClient({ baseUrl, fetch })`. */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  baseUrl: string;
  /** The workspace root dir, when `workspace: true`. */
  workspaceRoot?: string;
  stop: () => Promise<void>;
}

export async function startHarnessServer(
  aimockBaseUrl: string,
  options: ScenarioServerOptions = {},
): Promise<ScenarioServer> {
  const { yolo = true, workspace: withWorkspace = false } = options;
  const openai = createOpenAI({ apiKey: 'scenario-key', baseURL: aimockBaseUrl });

  let workspace: Workspace | undefined;
  let workspaceRoot: string | undefined;
  let tools: Record<string, unknown> | undefined;
  if (withWorkspace) {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'mc-web-scenario-'));
    workspace = new Workspace({
      id: 'scenario-workspace',
      name: 'Scenario Workspace',
      filesystem: new LocalFilesystem({ basePath: workspaceRoot, allowedPaths: [workspaceRoot] }),
      sandbox: new LocalSandbox({ workingDirectory: workspaceRoot }),
    });
    tools = await createWorkspaceTools(workspace);
  }

  // Minimal request_access tool — mirrors mastracode's version but without the
  // filesystem logic. Suspends with a sandbox_access_request payload and resumes
  // with the user's approve/deny answer.
  const requestAccessTool = createTool({
    id: 'request_access',
    description: 'Request permission to access a directory outside the project.',
    inputSchema: z.object({
      path: z.string().min(1).describe('The absolute path to the directory.'),
      reason: z.string().min(1).describe('Why you need access.'),
    }),
    suspendSchema: z.object({
      kind: z.literal('sandbox_access_request'),
      path: z.string(),
      reason: z.string(),
    }),
    resumeSchema: z.union([z.string(), z.array(z.string())]),
    execute: async ({ path: requestedPath, reason }: { path: string; reason: string }, context: any) => {
      const suspend = context?.agent?.suspend ?? context?.suspend;
      const resumeData = context?.agent?.resumeData ?? context?.resumeData;
      if (resumeData === undefined) {
        if (!suspend) return { content: 'No interactive context available.', isError: true };
        await suspend({ kind: 'sandbox_access_request', path: requestedPath, reason });
        return;
      }
      const answer = Array.isArray(resumeData) ? resumeData.join(', ') : String(resumeData);
      const approved = answer.toLowerCase().startsWith('y') || answer.toLowerCase() === 'approve';
      return approved
        ? { content: `Access granted: "${requestedPath}" has been added to allowed paths.` }
        : { content: `Access denied: The user declined access to "${requestedPath}".` };
    },
  } as any);

  const agent = new Agent({
    id: 'code-agent',
    name: 'code-agent',
    instructions: 'You are a coding assistant for scenario tests.',
    model: openai('gpt-5.4-mini'),
    tools: { ...(tools ?? {}), request_access: requestAccessTool } as any,
  });

  const harness = new Harness({
    id: HARNESS_ID,
    storage: new InMemoryStore(),
    ...(workspace ? { workspace } : {}),
    // Auto-approve tool calls (yolo) so scenarios exercise the full
    // execute-and-suspend path for built-in interactive tools (ask_user,
    // submit_plan) without a separate approval round-trip. Disable to test the
    // tool-approval flow.
    initialState: { yolo },
    modes: [
      { id: 'build', name: 'Build', default: true, agent },
      { id: 'plan', name: 'Plan', agent, transitionsTo: 'build' },
    ],
    defaultModeId: 'build',
  });

  const notifications = new InMemoryNotificationsStorage();
  const compositeStorage = new MastraCompositeStore({
    id: 'scenario-storage',
    domains: { notifications },
  });
  const mastra = new Mastra({ harnesses: { [HARNESS_ID]: harness }, storage: compositeStorage });

  const app = new Hono();
  mountHarnessRoutes(app, SERVER_ROUTES as unknown as ServerRouteLike[], mastra);

  const BASE = 'http://scenario.local';
  return {
    fetch: (url: string, init?: RequestInit) => {
      const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
      return Promise.resolve(app.fetch(new Request(fullUrl, init)));
    },
    baseUrl: BASE,
    workspaceRoot,
    stop: async () => {},
  };
}

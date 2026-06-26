import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { MastraBrowser } from '@mastra/core/browser';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
// Mount Mastra's HTTP surface via the official Hono server adapter — the exact
// same adapter `mastra dev` and the production web server use, so scenarios
// exercise the real routing (schema validation, SSE framing, error handling).
import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { Hono } from 'hono';
import { z } from 'zod';

/**
 * In-process Mastra controller server for scenario tests.
 *
 * Builds a real {@link AgentController} (model pointed at AIMock), registers it on a
 * real {@link Mastra}, then mounts the real `@mastra/server` controller routes on a
 * real Hono app. `app.fetch` is handed to the `@mastra/client-js` MastraClient,
 * so a scenario drives the full production stack:
 *
 *   MastraClient → Hono → @mastra/server route handlers → AgentController session →
 *   AIMock model → SSE events back to the client.
 */

const CONTROLLER_ID = 'code';

export interface ScenarioServerOptions {
  /** Auto-approve all tool calls (default true). Set false to test approvals. */
  yolo?: boolean;
  /** Attach a real sandboxed workspace + file/shell tools to the agent. */
  workspace?: boolean;
  /** Attach lightweight browser tools to the agent, matching provider tool names. */
  browser?: 'stagehand' | 'agent-browser' | false;
  /**
   * Build the AgentController with no storage of its own and configure storage on the
   * parent Mastra instead, exercising AgentController#resolveStorage inheritance (the
   * production web-server wiring). Default false (controller owns its storage).
   */
  inheritStorageFromMastra?: boolean;
}

export interface ScenarioServer {
  /** Pass to `new MastraClient({ baseUrl, fetch })`. */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  baseUrl: string;
  /** The workspace root dir, when `workspace: true`. */
  workspaceRoot?: string;
  stop: () => Promise<void>;
}

function createScenarioBrowser(provider: 'stagehand' | 'agent-browser'): MastraBrowser {
  const currentUrl = 'https://openclaw.ai';
  const toolName = provider === 'stagehand' ? 'stagehand_navigate' : 'browser_goto';
  const tools = {
    [toolName]: createTool({
      id: toolName,
      description: `Scenario ${provider} navigation tool.`,
      inputSchema: z.object({ url: z.string().min(1) }),
      outputSchema: z.object({ success: z.boolean(), url: z.string() }),
      execute: async ({ url }: { url: string }) => ({ success: true, url }),
    }),
  };

  return {
    id: `scenario-${provider}-browser`,
    provider,
    providerType: 'sdk' as const,
    headless: true,
    getTools: () => tools,
    getInputProcessors: () => [],
    isBrowserRunning: () => true,
    hasThreadSession: () => true,
    getSessionId: (threadId?: string) => (threadId ? `scenario-browser:${threadId}` : 'scenario-browser'),
    getCurrentUrl: async () => currentUrl,
    getBrowserState: async () => ({
      tabs: [{ url: currentUrl, title: 'OpenClaw' }],
      activeTabIndex: 0,
    }),
    startScreencast: async () => ({ on: () => undefined, stop: () => undefined }),
    startScreencastIfBrowserActive: async () => null,
    injectMouseEvent: async () => undefined,
    injectKeyboardEvent: async () => undefined,
  } as unknown as MastraBrowser;
}

export async function startAgentControllerServer(
  aimockBaseUrl: string,
  options: ScenarioServerOptions = {},
): Promise<ScenarioServer> {
  const {
    yolo = true,
    workspace: withWorkspace = false,
    browser: browserProvider = false,
    inheritStorageFromMastra = false,
  } = options;
  const openai = createOpenAI({ apiKey: 'scenario-key', baseURL: aimockBaseUrl });

  // A session always requires a Workspace instance (sessions own workspace +
  // browser since #18467), so every scenario gets a real sandboxed workspace
  // rooted at a temp dir. The `workspace` option only controls whether the
  // workspace file/shell *tools* are attached to the agent.
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'mc-web-scenario-'));
  const workspace = new Workspace({
    id: 'scenario-workspace',
    name: 'Scenario Workspace',
    filesystem: new LocalFilesystem({ basePath: workspaceRoot, allowedPaths: [workspaceRoot] }),
    sandbox: new LocalSandbox({ workingDirectory: workspaceRoot }),
  });
  const tools: Record<string, unknown> | undefined = withWorkspace ? await createWorkspaceTools(workspace) : undefined;

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

  const browser = browserProvider ? createScenarioBrowser(browserProvider) : undefined;
  const agent = new Agent({
    id: 'code-agent',
    name: 'code-agent',
    instructions: 'You are a coding assistant for scenario tests.',
    model: openai('gpt-5.4-mini'),
    tools: { ...(tools ?? {}), request_access: requestAccessTool } as any,
    ...(browser ? { browser } : {}),
  });

  // A registered AgentController always reads storage through its parent Mastra
  // (`#resolveStorage()` prefers the external Mastra's store), so the parent
  // composite below owns the durable `memory` domain. When NOT exercising the
  // inheritance path explicitly, the AgentController also gets its own ephemeral libsql
  // store. We use libsql (not a bare InMemoryStore) because it is a real
  // composite store with a `memory` domain — matching production web wiring.
  const harnessStore = inheritStorageFromMastra
    ? undefined
    : new LibSQLStore({ id: 'scenario-controller-storage', url: 'file::memory:?cache=shared' });
  const controller = new AgentController({
    id: CONTROLLER_ID,
    ...(harnessStore ? { storage: harnessStore } : {}),
    workspace,
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
    // A registered AgentController resolves storage through this parent Mastra, so it
    // must own a real `memory` domain (the libsql default store) for thread/OM
    // persistence to land. We add it unconditionally so both the inheritance
    // path and the standalone path have a durable memory domain to read through.
    default: new LibSQLStore({ id: 'scenario-mastra-storage', url: 'file::memory:?cache=shared' }),
    domains: { notifications },
  });
  const mastra = new Mastra({ agentControllers: { [CONTROLLER_ID]: controller }, storage: compositeStorage });

  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
  const adapter = new MastraServer({ app, mastra });
  await adapter.init();

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

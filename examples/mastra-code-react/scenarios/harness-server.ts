import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryNotificationsStorage } from '@mastra/core/notifications';
import { InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import { z } from 'zod';
// Real server routes — the same objects `mastra dev` registers. We mount them
// on a real Hono app below, so scenarios exercise the production routing.
import { SERVER_ROUTES } from '@mastra/server/server-adapter';

// Hono is a dependency of @mastra/server; resolve it through that package so the
// example doesn't need its own copy pinned.
interface HonoApp {
  get(path: string, handler: (c: any) => Promise<Response> | Response): void;
  post(path: string, handler: (c: any) => Promise<Response> | Response): void;
  fetch(request: Request): Promise<Response>;
}
type HonoCtor = new () => HonoApp;

const requireHere = createRequire(import.meta.url);
const requireFromServer = createRequire(requireHere.resolve('@mastra/server/package.json'));
const { Hono } = requireFromServer('hono') as { Hono: HonoCtor };

// Resolve the AI SDK v5 OpenAI provider via mastracode (the example's own copy
// is an older AI SDK v4 build, which the harness `stream()` path rejects).
type CreateOpenAI = (opts: { apiKey: string; baseURL: string }) => (modelId: string) => any;
const requireFromMastraCode = createRequire(requireHere.resolve('../../../mastracode/package.json'));
const { createOpenAI } = requireFromMastraCode('@ai-sdk/openai') as { createOpenAI: CreateOpenAI };

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

interface ServerRouteLike {
  method: string;
  path: string;
  responseType?: string;
  handler: (args: any) => Promise<unknown> | unknown;
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

  for (const route of SERVER_ROUTES as ServerRouteLike[]) {
    if (typeof route.path !== 'string' || !route.path.includes('harness')) continue;
    const honoPath = `/api${route.path}`; // MastraClient prefixes /api
    const method = route.method.toLowerCase() as 'get' | 'post';
    app[method](honoPath, c => invokeRoute(route, c, mastra));
  }

  return {
    fetch: (url, init) => app.fetch(new Request(url, init)),
    baseUrl: 'http://scenario.local',
    workspaceRoot,
    stop: async () => {},
  };
}

/**
 * Generic Hono → route-handler binding. Mirrors how the real Hono server
 * adapter calls a route: collect path + body params, invoke the handler, then
 * stream (SSE) or JSON-encode the result.
 */
async function invokeRoute(route: ServerRouteLike, c: any, mastra: Mastra): Promise<Response> {
  /* c is a Hono Context */
  const params: Record<string, unknown> = { mastra, ...c.req.param() };
  if (route.method.toUpperCase() === 'POST') {
    try {
      Object.assign(params, await c.req.json());
    } catch {
      /* no body */
    }
  }

  if (route.responseType === 'stream') {
    const abortController = new AbortController();
    params.abortSignal = abortController.signal;
    c.req.raw.signal?.addEventListener('abort', () => abortController.abort(), { once: true });
    const stream = (await route.handler(params)) as ReadableStream<string>;
    return new Response(encodeStream(stream), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  const result = await route.handler(params);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
}

/** The stream handler yields strings; encode them to bytes for the Response. */
function encodeStream(stream: ReadableStream<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(value));
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}

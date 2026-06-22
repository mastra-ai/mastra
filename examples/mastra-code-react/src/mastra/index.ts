import path from 'node:path';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

/**
 * Example: MastraCode as a web app.
 *
 * A coding Harness is registered on the Mastra instance. `mastra dev` then
 * serves the harness session routes (`/harness/...`), so a browser client can
 * create sessions, stream events over SSE, and send messages — the same model
 * the terminal MastraCode uses, projected over HTTP.
 */

const storage = new LibSQLStore({ id: 'mastra-code-example', url: 'file:./database.sqlite' });

const memory = new Memory({
  storage,
  options: {
    lastMessages: 40,
    semanticRecall: false,
    observationalMemory: {
      enabled: true,
    },
  },
});

// Default workspace directory (used when no project is selected).
const defaultWorkspaceRoot = path.resolve(process.cwd(), 'workspace');

/**
 * Build a Workspace for the given base path. Each unique path gets a fresh
 * Workspace with its own LocalFilesystem + LocalSandbox confined to that
 * directory.
 */
function buildWorkspace(basePath: string): Workspace {
  const resolved = path.resolve(basePath);
  return new Workspace({
    id: `workspace-${resolved}`,
    name: path.basename(resolved),
    filesystem: new LocalFilesystem({ basePath: resolved, allowedPaths: [resolved] }),
    sandbox: new LocalSandbox({ workingDirectory: resolved }),
  });
}

// Create a default workspace so we can register tools on the agent eagerly.
// At runtime, the workspace factory below overrides the actual workspace
// per-request based on the session's `projectPath` state.
const defaultWorkspace = buildWorkspace(defaultWorkspaceRoot);
const workspaceTools = await createWorkspaceTools(defaultWorkspace);

const codingAgent = new Agent({
  id: 'mastra-code',
  name: 'mastra-code',
  instructions: ({ requestContext }) => {
    const harness = requestContext.get('harness') as HarnessRequestContext<Record<string, unknown>> | undefined;
    const projectPath = harness?.state?.projectPath as string | undefined;
    const base = [
      'You are a coding assistant operating inside a web IDE.',
      'Use your workspace tools to read, write, and run code in the project directory.',
      'Keep responses concise. When you change a file, say what you changed and why.',
    ];
    if (projectPath) {
      base.push(`The active project directory is: ${projectPath}`);
    }
    return base.join(' ');
  },
  model: openai('gpt-4o-mini'),
  tools: workspaceTools,
});

export const codeHarness = new Harness({
  id: 'code',
  storage,
  memory,
  omConfig: {
    defaultObserverModelId: 'openai/gpt-4o-mini',
    defaultReflectorModelId: 'openai/gpt-4o-mini',
    defaultObservationThreshold: 4000,
    defaultReflectionThreshold: 8000,
  },
  // Dynamic workspace factory: reads `projectPath` from session state.
  // When a user selects a project in the web UI, the client calls
  // `session.setState({ projectPath: '/abs/path' })` and subsequent
  // messages resolve workspace tools to that directory.
  workspace: ({ requestContext }) => {
    const harness = requestContext.get('harness') as HarnessRequestContext<Record<string, unknown>> | undefined;
    const projectPath = harness?.state?.projectPath as string | undefined;
    const basePath = projectPath && typeof projectPath === 'string' ? projectPath : defaultWorkspaceRoot;
    return buildWorkspace(basePath);
  },
  modes: [
    {
      id: 'build',
      name: 'Build',
      default: true,
      agent: codingAgent,
      instructions: 'Implement changes directly. Prefer small, verifiable edits.',
    },
    {
      id: 'plan',
      name: 'Plan',
      agent: codingAgent,
      instructions: 'Think through the approach and outline steps before editing. Do not write files in this mode.',
      transitionsTo: 'build',
    },
  ],
  defaultModeId: 'build',
});

export const mastra = new Mastra({
  storage,
  harnesses: { code: codeHarness },
});

import path from 'node:path';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core/mastra';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';

/**
 * Example: MastraCode as a web app.
 *
 * A coding Harness is registered on the Mastra instance. `mastra dev` then
 * serves the harness session routes (`/harness/...`), so a browser client can
 * create sessions, stream events over SSE, and send messages — the same model
 * the terminal MastraCode uses, projected over HTTP.
 */

const storage = new LibSQLStore({ id: 'mastra-code-example', url: 'file:./database.sqlite' });

// One sandboxed workspace over ./workspace. This gives the agent the real
// Mastra file/shell/search tools (read, write, edit, list, run, …) with proper
// path confinement — no need to hand-roll filesystem tools.
const workspaceRoot = path.resolve(process.cwd(), 'workspace');

const workspace = new Workspace({
  id: 'mastra-code-example',
  name: 'Mastra Code Example Workspace',
  filesystem: new LocalFilesystem({ basePath: workspaceRoot, allowedPaths: [workspaceRoot] }),
  sandbox: new LocalSandbox({ workingDirectory: workspaceRoot }),
});

const workspaceTools = await createWorkspaceTools(workspace);

const codingAgent = new Agent({
  id: 'mastra-code',
  name: 'mastra-code',
  instructions: [
    'You are a coding assistant operating inside a small web IDE.',
    'Use your workspace tools to read, write, and run code in the workspace.',
    'Keep responses concise. When you change a file, say what you changed and why.',
  ].join(' '),
  model: openai('gpt-4o-mini'),
  tools: workspaceTools,
});

export const codeHarness = new Harness({
  id: 'code',
  storage,
  workspace,
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

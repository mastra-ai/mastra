import { Agent } from '@mastra/core/agent';
import { E2BSandbox } from '../e2b-sandbox';
import { Workspace } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

const sandbox = new E2BSandbox({
  timeout: 60_000,
  runtimes: ['node', 'python', 'bash'],
  // Dynamic sandbox ID - each thread/resource gets its own sandbox
  id: ctx => {
    const parts = [ctx.resourceId, ctx.threadId].filter(Boolean);
    if (parts.length === 0) {
      return 'default';
    }
    return `${parts.join('-')}`;
  },
});

export const e2bWorkspace = new Workspace({
  id: 'e2b-workspace',
  name: 'E2B Workspace',
  sandbox,
  filesystem: sandbox.filesystem,
  // Note: Don't use skillsPaths with E2B sandboxes - skills discovery happens at startup
  // (not lazily), which would create a sandbox with no context (using 'default' ID).
  // If you need skills, use a LocalFilesystem for skills discovery instead.
});

const storage = new LibSQLStore({
  id: 'e2b-agent-storage',
  url: `file:${process.env.MASTRA_DB_PATH}/mastra.db`,
});

const memory = new Memory({
  storage,
});

/**
 * E2B agent - executes code in E2B cloud sandboxes directly.
 *
 * Uses @e2b/code-interpreter package directly (no ComputeSDK abstraction).
 *
 * Requirements:
 * - Install @e2b/code-interpreter: npm install @e2b/code-interpreter
 * - Set E2B_API_KEY environment variable
 */
export const e2bAgent = new Agent({
  id: 'e2b-agent',
  name: 'E2B Agent',
  description: 'An agent that executes code in E2B cloud sandboxes.',
  instructions: `You are a cloud code execution assistant using E2B sandboxes.

Your job is to help run code securely in isolated E2B cloud sandboxes.

Key capabilities:
1. Execute Python code for data analysis and scripting
2. Execute JavaScript/TypeScript code for Node.js tasks
3. Run bash commands for system operations
4. Install packages in the sandbox environment
5. Read and write files in the cloud sandbox filesystem

Benefits of E2B sandboxes:
- Code runs in isolated cloud environments
- Fast startup times
- Support for Python and JavaScript/TypeScript
- Secure execution of untrusted code
- Unified filesystem - files written are visible to code and vice versa

When running code:
1. Choose the appropriate runtime (python, node, or bash)
2. Use execute_code for running code snippets
3. Use execute_command for shell commands
4. Use workspace file tools to read/write files in the sandbox
5. Report output and any errors clearly

Use workspace sandbox tools to execute code in the cloud.`,

  model: 'openai/gpt-5.1',
  workspace: e2bWorkspace,
  memory,
});

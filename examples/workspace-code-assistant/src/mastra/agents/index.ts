import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

// Create the workspace with both filesystem and sandbox
export const workspace = new Workspace({
  name: 'code-assistant-workspace',
  filesystem: new LocalFilesystem({
    basePath: './workspace-files',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-files',
    timeout: 30000,
  }),
});

/**
 * Code Assistant Agent
 *
 * An agent with full workspace capabilities:
 * - Read/write files
 * - List directory contents
 * - Execute code (Node.js, Python, shell)
 * - Run shell commands
 *
 * Workspace tools are automatically injected when workspace is configured.
 */
export const codeAssistantAgent = new Agent({
  id: 'code-assistant',
  name: 'Code Assistant',
  instructions: `You are a helpful coding assistant with access to a workspace.

You have the following capabilities:
- **File Operations**: Read, write, list, and delete files in the workspace
- **Code Execution**: Run Node.js, Python, and shell code
- **Command Execution**: Run shell commands like npm, pip, etc.

When asked to create or modify code:
1. Write the code to a file using workspace_write_file
2. Execute it using workspace_execute_code to verify it works
3. Report the results back to the user

When debugging:
1. Read the existing file with workspace_read_file
2. Identify the issue
3. Write the fixed version
4. Test it with workspace_execute_code

Always explain what you're doing and show relevant output.
Keep file paths simple (e.g., /hello.py, /utils/math.js).`,

  model: openai('gpt-4o'),
  workspace,
});

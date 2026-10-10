import assert from 'node:assert/strict';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';

// Provider-independent reproduction. An observation abort does not prove remote termination.
const abort = new AbortController();
const sandbox: WorkspaceSandbox = {
  id: 'caller-owned',
  name: 'Remote observer',
  provider: 'reproduction',
  status: 'running',
  snapshot: async () => {},
  executeCommand: async () => {
    abort.abort();
    throw new Error('Observation aborted. Remote work may still be running.');
  },
};
const workspace = new Workspace({ sandbox });
const tools = await createWorkspaceTools(workspace);
const output = await tools.mastra_workspace_execute_command.execute(
  { command: 'sleep 60' },
  { abortSignal: abort.signal },
);
console.log(output);
assert.doesNotMatch(output, /so it was killed/, 'An aborted signal alone cannot establish that remote work was killed');
assert.match(output, /Remote work may still be running/);

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
// import { testAgentWorkspace } from '../workspaces';

/**
 * Test agent with a workspace that has a different filesystem basePath.
 * Used to verify the UI shows different files for different workspaces.
 */
export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent with its own isolated workspace filesystem.',
  instructions: `You are a test agent with access to your own workspace.
Your workspace contains files that are different from the global workspace.`,
  model: 'openai/gpt-5.1',
  // workspace: testAgentWorkspace,
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});

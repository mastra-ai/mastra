import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { AGENT_BUILDER_ROUTES } from '../agent-builder';
import { createRouteTestSuite } from './route-test-suite';
import { createTestAgent, mockAgentMethods, createTestMastra, createTestWorkflow } from './test-setup-helpers';

describe('Agent Builder Routes', () => {
  let mastra: Mastra;
  let testAgent: Agent;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create agent with all mocks configured
    testAgent = createTestAgent();
    mockAgentMethods(testAgent);

    // Create workflow
    const testWorkflow = createTestWorkflow();

    // Create Mastra instance
    mastra = createTestMastra({
      agents: { 'test-agent': testAgent },
      workflows: { 'merge-template': testWorkflow }, // Use valid agent-builder action name
    });

    // Create and start a real workflow run so handlers can retrieve it
    const run = await testWorkflow.createRun({
      runId: 'test-run',
    });
    await run.start({ inputData: { name: 'test' } });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: AGENT_BUILDER_ROUTES,
    getMastra: () => mastra,
  });
});

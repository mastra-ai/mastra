import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { AGENT_BUILDER_ROUTES } from '../agent-builder';
import { createRouteTestSuite } from './route-test-suite';
import { createTestAgent, mockAgentMethods, createTestMastra } from './test-setup-helpers';

describe('Agent Builder Routes', () => {
  let mastra: Mastra;
  let testAgent: Agent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create agent with all mocks configured
    testAgent = createTestAgent();
    mockAgentMethods(testAgent);

    // Create Mastra instance
    mastra = createTestMastra({
      agents: { 'test-agent': testAgent },
    });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: AGENT_BUILDER_ROUTES,
    getMastra: () => mastra,
  });
});

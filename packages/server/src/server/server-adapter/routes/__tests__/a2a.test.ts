import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { A2A_ROUTES } from '../a2a';
import { createRouteTestSuite } from './route-test-suite';
import { createTestAgent, mockAgentMethods, createTestMastra } from './test-helpers';

describe('A2A Routes', () => {
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
    routes: A2A_ROUTES,
    getMastra: () => mastra,
  });
});

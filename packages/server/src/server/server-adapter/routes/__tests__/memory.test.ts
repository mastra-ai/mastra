import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { MEMORY_ROUTES } from '../memory';
import { createRouteTestSuite } from './route-test-suite';
import { createMockMemory, createTestMastra, createTestAgent, mockAgentMethods } from './test-helpers';

describe('Memory Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create memory instance with InMemoryStore (following handler test pattern)
    const memory = createMockMemory();

    // Create agent WITH memory (needed for memory routes with agentId query param)
    const testAgent = createTestAgent({ memory });
    mockAgentMethods(testAgent);

    // Create Mastra instance with both global memory and agent
    mastra = createTestMastra({
      memory,
      agents: { 'test-agent': testAgent },
    });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: MEMORY_ROUTES,
    getMastra: () => mastra,
  });
});

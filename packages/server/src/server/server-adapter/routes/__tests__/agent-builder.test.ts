import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi, afterEach } from 'vitest';
import { AGENT_BUILDER_ROUTES } from '../agent-builder';
import { createRouteTestSuite } from './route-test-suite';
import { setupAgentBuilderTests } from './test-helpers';

describe('Agent Builder Routes', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use helper to set up agent-builder test environment
    const setup = await setupAgentBuilderTests();
    mastra = setup.mastra;
    const setupMocks = setup.setupMocks;

    // Set up WorkflowRegistry mocks
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: AGENT_BUILDER_ROUTES,
    getMastra: () => mastra,
  });
});

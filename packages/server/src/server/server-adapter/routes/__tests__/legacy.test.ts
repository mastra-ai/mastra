import type { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi, it, expect } from 'vitest';
import { LEGACY_ROUTES } from '../legacy';
import { createRouteTestSuite } from './route-test-suite';
import { setupLegacyTests } from './test-helpers';

describe('Legacy Routes', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use helper to set up legacy test environment (includes agents, workflows, and agent-builder)
    const setup = await setupLegacyTests();
    mastra = setup.mastra;
    const setupMocks = setup.setupMocks;

    // Set up WorkflowRegistry mocks for agent-builder routes
    setupMocks();
  });

  // Run standard route tests using the test suite
  createRouteTestSuite({
    routes: LEGACY_ROUTES,
    getMastra: () => mastra,
  });
});

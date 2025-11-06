import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { WORKFLOWS_ROUTES } from '../workflows';
import { createRouteTestSuite } from './route-test-suite';
import { setupWorkflowTests } from './test-helpers';

describe('Workflow Routes', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use helper to set up workflow test environment with suspended run support
    const setup = await setupWorkflowTests();
    mastra = setup.mastra;
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: WORKFLOWS_ROUTES,
    getMastra: () => mastra,
  });
});

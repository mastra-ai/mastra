import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { SCORES_ROUTES } from '../scorers';
import { createRouteTestSuite } from './route-test-suite';
import { setupAgentTests } from './test-helpers';

describe('Scores Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Mastra instance
    const setup = setupAgentTests();
    mastra = setup.mastra;
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: SCORES_ROUTES,
    getMastra: () => mastra,
  });
});

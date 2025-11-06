import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { SCORES_ROUTES } from '../scorers';
import { createRouteTestSuite } from './route-test-suite';
import { createTestMastra } from './test-setup-helpers';

describe('Scores Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Mastra instance
    mastra = createTestMastra();
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: SCORES_ROUTES,
    getMastra: () => mastra,
  });
});

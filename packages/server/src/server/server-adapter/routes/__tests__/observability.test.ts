import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { OBSERVABILITY_ROUTES } from '../observability';
import { createRouteTestSuite } from './route-test-suite';
import { createTestMastra } from './test-setup-helpers';

describe('Observability Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Mastra instance
    mastra = createTestMastra();
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: OBSERVABILITY_ROUTES,
    getMastra: () => mastra,
  });
});

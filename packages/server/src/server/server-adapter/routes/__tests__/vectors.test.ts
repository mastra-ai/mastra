import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { VECTORS_ROUTES } from '../vectors';
import { createRouteTestSuite } from './route-test-suite';
import { createTestMastra } from './test-setup-helpers';

describe('Vectors Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Mastra instance (vectors are optional)
    mastra = createTestMastra();
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: VECTORS_ROUTES,
    getMastra: () => mastra,
  });
});

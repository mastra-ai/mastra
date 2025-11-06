import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { VECTORS_ROUTES } from '../vectors';
import { createRouteTestSuite } from './route-test-suite';
import { createTestMastra, createMockVector } from './test-helpers';

describe('Vectors Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock vector using helper
    const mockVector = createMockVector();

    // Create Mastra instance with mock vector
    mastra = createTestMastra({
      vectors: { 'test-vector': mockVector },
    });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: VECTORS_ROUTES,
    getMastra: () => mastra,
  });
});

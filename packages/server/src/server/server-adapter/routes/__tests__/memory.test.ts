import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { MEMORY_ROUTES } from '../memory';
import { createRouteTestSuite } from './route-test-suite';
import { createMockMemory, createTestMastra } from './test-setup-helpers';

describe('Memory Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create memory instance
    const memory = createMockMemory();

    // Create Mastra instance
    mastra = createTestMastra({
      memory,
    });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: MEMORY_ROUTES,
    getMastra: () => mastra,
  });
});

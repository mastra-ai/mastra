import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { MEMORY_ROUTES } from '../memory';
import { createRouteTestSuite } from './route-test-suite';
import { setupMemoryTests } from './test-helpers';

describe('Memory Routes', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();

    const setup = await setupMemoryTests();
    mastra = setup.mastra;
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: MEMORY_ROUTES,
    getMastra: () => mastra,
  });
});

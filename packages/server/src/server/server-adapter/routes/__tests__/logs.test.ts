import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { LOGS_ROUTES } from '../logs';
import { createRouteTestSuite } from './route-test-suite';
import { createTestMastra } from './test-setup-helpers';

describe('Logs Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Mastra instance
    mastra = createTestMastra();
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: LOGS_ROUTES,
    getMastra: () => mastra,
  });
});

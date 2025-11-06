import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { OBSERVABILITY_ROUTES } from '../observability';
import { createRouteTestSuite } from './route-test-suite';
import { setupObservabilityTests } from './test-helpers';

describe('Observability Routes', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await setupObservabilityTests();
    mastra = setup.mastra;
  });

  createRouteTestSuite({
    routes: OBSERVABILITY_ROUTES,
    getMastra: () => mastra,
  });
});

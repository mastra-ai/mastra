import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { AGENTS_ROUTES } from '../agents';
import { createRouteTestSuite } from './route-test-suite';
import { setupAgentTests } from './test-helpers';

describe('Agent Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    const setup = setupAgentTests();
    mastra = setup.mastra;
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: AGENTS_ROUTES,
    getMastra: () => mastra,
  });
});

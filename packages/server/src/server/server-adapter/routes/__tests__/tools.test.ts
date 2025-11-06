import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { TOOLS_ROUTES } from '../tools';
import { createRouteTestSuite } from './route-test-suite';
import { createTestTool, createTestMastra } from './test-helpers';

describe('Tools Routes', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create test tool
    const testTool = createTestTool();

    // Create Mastra instance
    mastra = createTestMastra({
      tools: { 'test-tool': testTool },
    });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: TOOLS_ROUTES,
    getMastra: () => mastra,
  });
});

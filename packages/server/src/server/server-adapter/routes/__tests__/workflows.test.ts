import { Mastra } from '@mastra/core/mastra';
import { describe, beforeEach, vi } from 'vitest';
import { WORKFLOWS_ROUTES } from '../workflows';
import { createRouteTestSuite } from './route-test-suite';
import { createTestWorkflow, createTestMastra } from './test-setup-helpers';

describe('Workflow Routes', () => {
  let mastra: Mastra;
  let testWorkflow: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create workflow with all steps configured
    testWorkflow = createTestWorkflow();

    // Create Mastra instance
    mastra = createTestMastra({
      workflows: { 'test-workflow': testWorkflow },
    });

    // Create and start a real workflow run so handlers can retrieve it
    const run = await testWorkflow.createRun({
      runId: 'test-run',
    });
    await run.start({ inputData: { name: 'test' } });
  });

  // Create test suite with auto-generated bodies!
  createRouteTestSuite({
    routes: WORKFLOWS_ROUTES,
    getMastra: () => mastra,
  });
});

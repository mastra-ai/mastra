/**
 * Shared test context type for all integration test scenarios.
 */

import type { Workspace } from '@mastra/core/workspace';

export interface TestContext {
  workspace: Workspace;
  getTestPath: () => string;
  testTimeout: number;
  fastOnly: boolean;
  sandboxPathsAligned: boolean;
}

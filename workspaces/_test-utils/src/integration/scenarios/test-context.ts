/**
 * Shared test context type for all integration test scenarios.
 */

import type { Workspace } from '@mastra/core/workspace';

export interface TestContext {
  workspace: Workspace;
  getTestPath: () => string;
  /** Mount path prefix for sandbox commands (e.g. '/data/s3'). Empty string if paths match. */
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
  sandboxPathsAligned: boolean;
}

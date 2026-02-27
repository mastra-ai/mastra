/**
 * PTY Process Manager Integration Tests (Approach A)
 *
 * Runs the shared conformance suite with DaytonaPtyProcessManager
 * injected via _processManagerOverride.
 *
 * Expected results:
 * - stdout accumulation: PASS
 * - stderr accumulation: PASS (deferred read from temp file)
 * - onStdout callback streaming: PASS
 * - onStderr callback streaming: FAIL (batch after exit — known limitation)
 * - stdin / sendStdin: PASS
 * - exit codes: PASS (sentinel + wait())
 * - tracking/pruning: PASS
 * - concurrent processes: PASS
 * - kill semantics: PASS
 *
 * Required environment variables:
 * - DAYTONA_API_KEY: Daytona API key
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe } from 'vitest';

import { DaytonaSandbox } from './index';
import { DaytonaPtyProcessManager } from './process-manager-pty';

/**
 * Conformance suite with PTY process manager.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Conformance (PTY Process Manager)', () => {
  createSandboxTestSuite({
    suiteName: 'DaytonaSandbox (PTY)',
    createSandbox: async options => {
      const ptyProcessManager = new DaytonaPtyProcessManager({
        env: options?.env,
        defaultTimeout: 60000,
      });

      return new DaytonaSandbox({
        id: `pty-conformance-${Date.now()}`,
        timeout: 60000,
        language: 'typescript',
        ...(options?.env && { env: options.env }),
        _processManagerOverride: ptyProcessManager,
      });
    },
    createInvalidSandbox: () =>
      new DaytonaSandbox({
        id: `pty-bad-config-${Date.now()}`,
        image: 'nonexistent/fake-image:latest',
      }),
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsConcurrency: true,
    },
    testTimeout: 120000,
  });
});

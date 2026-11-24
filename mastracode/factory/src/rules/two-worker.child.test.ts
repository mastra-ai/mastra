import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, it } from 'vitest';

import { autoStartingBoards, createLifecycleTestRegistry } from '../boards/test-utils.js';
import { observeSessionRunEnd } from '../session/run-audit.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';
import { createFileSession, TWO_WORKER_DIR_ENV } from './two-worker.fixture.js';

/**
 * Worker A of `dispatcher.two-worker.test.ts`, run in its own process. It attaches the session's
 * sandbox, kicks off the queued phase run and keeps it running until the test kills the process.
 */
const dir = process.env[TWO_WORKER_DIR_ENV];

describe.skipIf(!dir)('two-worker test, worker A', () => {
  it('runs the phase until it is killed', { timeout: 600_000 }, async () => {
    const seed = await createFactoryStorageForTests(
      new LibSQLFactoryStorage({ id: 'factory-two-worker', url: `file:${join(dir!, 'factory.db')}` }),
    );
    const sourceControl = seed.sourceControl.forIntegration('github');
    const sourceSession = await sourceControl.sessions.getBySessionId('session-1');
    if (!sourceSession) throw new Error('The test seeds the source-control session before starting worker A.');
    // What the workspace does once the provider starts the session's VM.
    await sourceControl.sessions.setSandbox({
      id: sourceSession.id,
      sandboxId: 'vm-started-by-worker-a',
      sandboxWorkdir: '/workspace/repo',
    });

    const { session, controller } = createFileSession(dir!, { runsFinish: false });
    observeSessionRunEnd(session as never, { audit: seed.audit, openRuns: seed.openRuns });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: controller as never,
      boards: autoStartingBoards(),
      transitionService: new FactoryTransitionService({
        storage: seed.workItems,
        configVersion: 'rules-v1',
        boards: createLifecycleTestRegistry(),
      }),
      storage: seed.workItems,
      audit: seed.audit,
      openRuns: seed.openRuns,
      ownerId: 'worker-a',
    });
    void dispatcher.runOnce();

    for (;;) {
      if ((await seed.openRuns.listByThread('thread-1')).length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    writeFileSync(join(dir!, 'worker-a.ready'), '');
    await new Promise(() => {});
  });
});

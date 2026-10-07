import { execFileSync } from 'node:child_process';
import { detectProject } from '@mastra/code-sdk/utils/project';
import { settingsStartupModelRestoreScenario } from './settings-startup-model-restore.js';
import type { McE2eMastraCodeAppResult, McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function createModelRestoreScenario(legacy: boolean): McE2eScenario {
  const sessions = new Map<string, McE2eMastraCodeAppResult['session']>();
  const threadId = legacy ? 'legacy-model-restore-thread' : 'saved-model-restore-thread';
  const title = legacy ? 'Legacy model restore' : 'Saved model restore';
  const modelId = legacy ? 'legacy-restore-e2e/build-model' : 'saved-restore-e2e/build-model';
  const otherThreadId = `${threadId}-other`;
  const otherTitle = 'Other model restore';
  const otherModelId = 'other-restore-e2e/build-model';

  return {
    name: legacy ? 'legacy-thread-model-restore' : 'saved-thread-model-restore',
    description: 'Resuming and switching threads keeps saved models instead of applying the global pack.',
    testName: legacy
      ? 'preserves the migrated legacy build model during startup and thread switching'
      : 'preserves a version-2 saved model during startup and thread switching',
    inProcessApp({ startMastraCodeApp, dbPath }) {
      return startMastraCodeApp({
        tui: { resumeThreadId: threadId },
        onCreated(result) {
          sessions.set(dbPath, result.session);
        },
      });
    },
    prepare(context) {
      settingsStartupModelRestoreScenario.prepare(context);
      const project = detectProject(context.projectDir);
      const metadata = {
        projectPath: project.rootPath,
        currentModeId: 'build',
        ...(legacy
          ? {
              currentModelId: 'stale-create-time/model',
              modeModelId_build: modelId,
              modeModelId_plan: 'legacy-restore-e2e/plan-model',
            }
          : { currentModelId: modelId, modelPersistenceVersion: 2 }),
      };
      const otherMetadata = {
        projectPath: project.rootPath,
        currentModeId: 'build',
        currentModelId: otherModelId,
        modelPersistenceVersion: 2,
      };
      const now = new Date(0).toISOString();
      execFileSync('sqlite3', [context.dbPath], {
        input: `INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES (${quoteSql(threadId)}, ${quoteSql(project.resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify(metadata))}, ${quoteSql(now)}, ${quoteSql(now)}),
(${quoteSql(otherThreadId)}, ${quoteSql(project.resourceId)}, ${quoteSql(otherTitle)}, ${quoteSql(JSON.stringify(otherMetadata))}, ${quoteSql(now)}, ${quoteSql(now)});`,
      });
    },
    async run({ terminal, runtime, dbPath }) {
      const session = sessions.get(dbPath);
      if (!session) throw new Error('Expected the live fixture session');
      const assertSelection = async (expectedThreadId: string, expectedModelId: string) => {
        const metadata = (await session.thread.getById({ threadId: expectedThreadId }))?.metadata ?? {};
        if (session.thread.getId() !== expectedThreadId || session.model.get() !== expectedModelId) {
          throw new Error(`Expected active thread ${expectedThreadId} with model ${expectedModelId}`);
        }
        if (metadata.currentModelId !== expectedModelId || metadata.modelPersistenceVersion !== 2) {
          throw new Error(`Expected the saved model and version 2, got ${JSON.stringify(metadata)}`);
        }
        if (Object.keys(metadata).some(key => key.startsWith('modeModelId_')) || metadata.activeModelPackId) {
          throw new Error('Expected legacy mode keys to be removed without attaching the global pack');
        }
      };
      try {
        runtime.startLiveOutput(terminal);
        await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
        await runtime.waitForScreenText(new RegExp(`▐build▌${modelId}`, 'i'), terminal, 8_000);
        await assertSelection(threadId, modelId);

        terminal.submit('/threads');
        await runtime.waitForScreenText(/Select Thread/i, terminal, 8_000);
        terminal.write(otherTitle);
        await runtime.waitForScreenText(new RegExp(otherTitle, 'i'), terminal, 8_000);
        terminal.write('\r');
        await runtime.waitForScreenTextAbsent(/Select Thread/i, terminal, 8_000);
        await runtime.waitForScreenText(/▐build▌other-restore-e2e\/build-model/i, terminal, 8_000);
        await assertSelection(otherThreadId, otherModelId);

        terminal.submit('/threads');
        await runtime.waitForScreenText(/Select Thread/i, terminal, 8_000);
        terminal.write(title);
        await runtime.waitForScreenText(new RegExp(title, 'i'), terminal, 8_000);
        terminal.write('\r');
        await runtime.waitForScreenTextAbsent(/Select Thread/i, terminal, 8_000);
        await runtime.waitForScreenText(new RegExp(`▐build▌${modelId}`, 'i'), terminal, 8_000);
        await assertSelection(threadId, modelId);
        terminal.keyCtrlC();
      } finally {
        sessions.delete(dbPath);
      }
    },
  };
}

export const legacyThreadModelRestoreScenario = createModelRestoreScenario(true);
export const savedThreadModelRestoreScenario = createModelRestoreScenario(false);

import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, runCancelledProtocol, runProtocol } from '../helpers/run-protocol.js';
import {
  kitchenSinkScenario,
  persistenceIsolationScenario,
  sandboxCancellationScenario,
  workspaceSandboxScenario,
  workspaceSkillAgentScenario,
} from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('experiment worker workspace, sandbox, and persistence behavior', () => {
  const resources = new OwnedResources();
  let artifactRoot: string;
  let manifest: ExperimentWorkerManifest;

  beforeAll(async () => {
    const projectRoot = resources.trackPath(
      await materializeProject({
        fixtureDir: join(suiteRoot, 'fixtures', 'resources'),
        runRoot: inject('runRoot'),
        registry: inject('registry'),
        tag: inject('tag'),
        scenarioId: 'runtime-resources',
      }),
    );
    await installPnpmProject(projectRoot, inject('registry'));
    const build = await buildWorker(projectRoot);
    manifest = (await inspectManifest(build.artifactRoot)).manifest;
    artifactRoot = resources.trackPath(
      await copyArtifact({
        artifactRoot: build.artifactRoot,
        destinationRoot: join(inject('artifactRoot'), 'runtime-resources'),
        sourceRoots: [projectRoot, suiteRoot],
        deleteRoots: [projectRoot],
      }),
    );
  }, 240_000);

  afterAll(async () => {
    const cleanup = await resources.cleanup();
    expect(cleanup.remainingPaths).toEqual([]);
  });

  test(
    `${workspaceSkillAgentScenario.id} injects inherited workspace skill metadata into agent prompts`,
    async () => {
      const request = createRunRequest(manifest, {
        targetId: 'workspace-agent',
        items: [{ id: 'skill-item', input: 'are workspace skills visible?', toolMocks: [] }],
        timeoutMs: 30_000,
      });
      const run = await runProtocol(artifactRoot, manifest, request);
      const completed = run.events.find(event => event.type === 'item-completed');
      expect(JSON.stringify(completed)).toContain('skills:visible');
      expect(run.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      await recordAssertionEvidence(workspaceSkillAgentScenario, {
        'workspace-inherited': completed,
        'skill-discovered': completed,
        'skill-prompt-injected': completed,
      });
    },
    workspaceSkillAgentScenario.timeoutMs,
  );

  test(
    `${workspaceSandboxScenario.id} writes through the workspace filesystem and reads it back via the sandbox`,
    async () => {
      const request = createRunRequest(manifest, {
        targetType: 'workflow',
        targetId: 'workspace-workflow',
        items: [{ id: 'sandbox-item', input: { note: 'workspace note for sandbox' }, toolMocks: [] }],
        timeoutMs: 30_000,
      });
      const run = await runProtocol(artifactRoot, manifest, request);
      const completed = JSON.stringify(run.events.find(event => event.type === 'item-completed'));
      expect(completed).toContain('workspace note for sandbox');
      expect(completed).toContain('sandbox-echo-skill');
      expect(completed).toContain('"exitCode":0');
      expect(run.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      await recordAssertionEvidence(workspaceSandboxScenario, {
        'filesystem-write': completed,
        'sandbox-command': completed,
        'skill-listed': completed,
      });
    },
    workspaceSandboxScenario.timeoutMs,
  );

  test(
    `${sandboxCancellationScenario.id} cancels an in-flight sandbox command, terminates descendants, then succeeds`,
    async () => {
      const descendantFile = join(artifactRoot, 'sandbox-descendant.json');
      const request = createRunRequest(manifest, {
        targetType: 'workflow',
        targetId: 'sandbox-hang-workflow',
        items: [{ id: 'hang-item', input: { prompt: 'spawn and hang' }, toolMocks: [] }],
        timeoutMs: 60_000,
      });
      const cancelled = await runCancelledProtocol(artifactRoot, manifest, request, {
        readyWhen: () => pathExists(descendantFile),
      });

      expect(cancelled.exitCode).toBe(30);
      expect(cancelled.events.at(-1)?.payload).toMatchObject({ status: 'cancelled' });

      const descendant = JSON.parse(await readFile(descendantFile, 'utf8')) as { pid: number | string };
      const pid = Number(descendant.pid);
      expect(Number.isInteger(pid) && pid > 0).toBe(true);
      for (let attempt = 0; attempt < 50 && isProcessAlive(pid); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(isProcessAlive(pid)).toBe(false);

      const recovered = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'workspace-workflow',
          items: [{ id: 'recovery-item', input: { note: 'fresh process after cancel' }, toolMocks: [] }],
          timeoutMs: 30_000,
        }),
      );
      expect(recovered.result.exitCode).toBe(0);
      await recordAssertionEvidence(sandboxCancellationScenario, {
        'sandbox-command-started': descendant,
        'terminal-cancelled': cancelled.events.at(-1)?.payload,
        'descendant-terminated': !isProcessAlive(pid),
        'success-after-cancel': recovered.result.exitCode,
      });
    },
    sandboxCancellationScenario.timeoutMs,
  );

  test(
    `${kitchenSinkScenario.id} builds an import-heavy project and executes an agent and workflow without Studio`,
    async () => {
      const agent = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetId: 'workspace-agent',
          items: [{ id: 'kitchen-agent', input: 'are workspace skills visible?', toolMocks: [] }],
          timeoutMs: 30_000,
        }),
      );
      expect(JSON.stringify(agent.events)).toContain('skills:visible');

      const workflow = await runProtocol(
        artifactRoot,
        manifest,
        createRunRequest(manifest, {
          targetType: 'workflow',
          targetId: 'workspace-workflow',
          items: [{ id: 'kitchen-workflow', input: { note: 'kitchen sink workflow' }, toolMocks: [] }],
          timeoutMs: 30_000,
        }),
      );
      expect(JSON.stringify(workflow.events)).toContain('kitchen sink workflow');
      expect(agent.result.exitCode).toBe(0);
      expect(workflow.result.exitCode).toBe(0);
      await recordAssertionEvidence(kitchenSinkScenario, {
        'import-heavy-build': manifest.artifact.contentDigest,
        'selected-agent-executed': agent.events.at(-1)?.payload,
        'selected-workflow-executed': workflow.events.at(-1)?.payload,
        'studio-not-launched': true,
      });
    },
    kitchenSinkScenario.timeoutMs,
  );

  test(
    `${persistenceIsolationScenario.id} persists application data but never experiment or score records`,
    async () => {
      const request = createRunRequest(manifest, {
        targetType: 'workflow',
        targetId: 'persistence-workflow',
        items: [{ id: 'persist-item', input: { threadId: 'e2e-thread-1' }, toolMocks: [] }],
        scorers: [{ id: 'resource-score', version: 'fixture-v1' }],
        timeoutMs: 30_000,
      });
      const run = await runProtocol(artifactRoot, manifest, request);
      const completed = JSON.stringify(run.events.find(event => event.type === 'item-completed'));
      expect(completed).toContain('vec-a');
      expect(completed).toContain('resource-score');
      expect(run.events.at(-1)?.payload).toMatchObject({ status: 'completed' });

      // Direct database proof: application storage was written by the worker,
      // while experiment/score persistence stayed disabled.
      const client = createClient({ url: `file:${join(artifactRoot, 'app-storage.db')}` });
      try {
        const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
        const tableNames = tables.rows.map(row => String(row.name));
        expect(tableNames).toContain('mastra_threads');

        const threads = await client.execute("SELECT COUNT(*) AS count FROM mastra_threads WHERE id = 'e2e-thread-1'");
        expect(Number(threads.rows[0]?.count)).toBeGreaterThanOrEqual(1);

        for (const table of ['mastra_experiments', 'mastra_experiment_results', 'mastra_scorers']) {
          if (!tableNames.includes(table)) continue;
          const rows = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
          expect(Number(rows.rows[0]?.count)).toBe(0);
        }
      } finally {
        client.close();
      }
      const vectorStoreExists = await pathExists(join(artifactRoot, 'vector-store.db'));
      expect(vectorStoreExists).toBe(true);
      await recordAssertionEvidence(persistenceIsolationScenario, {
        'application-storage-written': completed,
        'vector-adapter-executed': vectorStoreExists,
        'experiment-records-absent': true,
        'score-records-absent': true,
      });
    },
    persistenceIsolationScenario.timeoutMs,
  );
});

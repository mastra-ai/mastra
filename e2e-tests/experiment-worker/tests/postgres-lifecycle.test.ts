import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { runCommand } from '../helpers/command.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, runProtocol } from '../helpers/run-protocol.js';
import { postgresScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function docker(args: string[], timeoutMs = 90_000) {
  const result = await runCommand('docker', args, { cwd: suiteRoot, timeoutMs });
  if (result.timedOut || result.exitCode !== 0) {
    throw new Error(`docker ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

describe('experiment worker Postgres lifecycle', () => {
  const resources = new OwnedResources();
  const containerName = `mastra-experiment-postgres-${randomUUID().slice(0, 8)}`;
  let artifactRoot: string;
  let manifest: ExperimentWorkerManifest;
  let connectionString: string;
  let containerStarted = false;

  beforeAll(async () => {
    const projectRoot = resources.trackPath(
      await materializeProject({
        fixtureDir: join(suiteRoot, 'fixtures', 'postgres'),
        runRoot: inject('runRoot'),
        registry: inject('registry'),
        tag: inject('tag'),
        scenarioId: 'postgres',
      }),
    );
    await installPnpmProject(projectRoot, inject('registry'));
    const build = await buildWorker(projectRoot);
    manifest = (await inspectManifest(build.artifactRoot)).manifest;
    artifactRoot = resources.trackPath(
      await copyArtifact({
        artifactRoot: build.artifactRoot,
        destinationRoot: join(inject('artifactRoot'), 'postgres'),
        sourceRoots: [projectRoot, suiteRoot],
        deleteRoots: [projectRoot],
      }),
    );

    const port = await getPort();
    connectionString = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
    await docker(
      [
        'run',
        '--detach',
        '--rm',
        '--name',
        containerName,
        '--env',
        'POSTGRES_PASSWORD=postgres',
        '--publish',
        `127.0.0.1:${port}:5432`,
        'postgres:16-alpine',
      ],
      240_000,
    );
    containerStarted = true;

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const readiness = await runCommand('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres'], {
        cwd: suiteRoot,
        timeoutMs: 10_000,
      });
      if (readiness.exitCode === 0) return;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Postgres did not become ready');
  }, 300_000);

  afterAll(async () => {
    if (containerStarted) {
      await runCommand('docker', ['rm', '--force', containerName], { cwd: suiteRoot, timeoutMs: 30_000 });
    }
    const cleanup = await resources.cleanup();
    expect(cleanup.remainingPaths).toEqual([]);
  });

  test(
    `${postgresScenario.id} persists application state without experiment records and releases connections`,
    async () => {
      const runWorker = async (threadId: string) => {
        const startedAt = Date.now();
        const run = await runProtocol(
          artifactRoot,
          manifest,
          createRunRequest(manifest, {
            targetType: 'workflow',
            targetId: 'postgres-workflow',
            items: [{ id: threadId, input: { threadId }, toolMocks: [] }],
            timeoutMs: 30_000,
          }),
          0,
          { env: { EXPERIMENT_WORKER_POSTGRES_URL: connectionString } },
        );
        expect(Date.now() - startedAt).toBeLessThan(15_000);
        return run;
      };

      await runWorker('postgres-thread-1');
      await runWorker('postgres-thread-2');

      const threads = await docker([
        'exec',
        containerName,
        'psql',
        '-U',
        'postgres',
        '-tAc',
        "SELECT COUNT(*) FROM mastra_threads WHERE id IN ('postgres-thread-1', 'postgres-thread-2')",
      ]);
      expect(Number(threads)).toBe(2);

      const tables = await docker([
        'exec',
        containerName,
        'psql',
        '-U',
        'postgres',
        '-tAc',
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      ]);
      for (const table of ['mastra_experiments', 'mastra_experiment_results', 'mastra_scorers']) {
        if (!tables.split('\n').includes(table)) continue;
        const count = await docker([
          'exec',
          containerName,
          'psql',
          '-U',
          'postgres',
          '-tAc',
          `SELECT COUNT(*) FROM ${table}`,
        ]);
        expect(Number(count)).toBe(0);
      }

      const remainingConnections = await docker([
        'exec',
        containerName,
        'psql',
        '-U',
        'postgres',
        '-tAc',
        "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid()",
      ]);
      expect(remainingConnections).toBe('0');
      await recordAssertionEvidence(postgresScenario, {
        'application-state-persisted': { threads: Number(threads) },
        'experiment-persistence-absent': { tables },
        'bounded-shutdown': true,
        'connection-reuse': { remainingConnections: Number(remainingConnections) },
        'docker-cleanup': containerName,
      });
    },
    postgresScenario.timeoutMs,
  );
});

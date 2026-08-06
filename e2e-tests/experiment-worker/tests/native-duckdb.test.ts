import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest, type ExperimentWorkerManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, runProtocol } from '../helpers/run-protocol.js';
import { nativeDuckdbScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('experiment worker native transitive dependency behavior', () => {
  const resources = new OwnedResources();
  let artifactRoot: string;
  let manifest: ExperimentWorkerManifest;

  beforeAll(async () => {
    // The native fixture installs into its own isolated root so DuckDB never
    // shares the runtime fixture's dependency layout.
    const projectRoot = resources.trackPath(
      await materializeProject({
        fixtureDir: join(suiteRoot, 'fixtures', 'native'),
        runRoot: inject('runRoot'),
        registry: inject('registry'),
        tag: inject('tag'),
        scenarioId: 'native-duckdb',
      }),
    );
    await installPnpmProject(projectRoot, inject('registry'));
    const build = await buildWorker(projectRoot);
    manifest = (await inspectManifest(build.artifactRoot)).manifest;
    artifactRoot = resources.trackPath(
      await copyArtifact({
        artifactRoot: build.artifactRoot,
        destinationRoot: join(inject('artifactRoot'), 'native-duckdb'),
        sourceRoots: [projectRoot, suiteRoot],
        deleteRoots: [projectRoot],
      }),
    );
  }, 300_000);

  afterAll(async () => {
    const cleanup = await resources.cleanup();
    expect(cleanup.remainingPaths).toEqual([]);
  });

  test(
    `${nativeDuckdbScenario.id} declares native externals and executes DuckDB in the relocated artifact`,
    async () => {
      const artifactManifest = JSON.parse(await readFile(join(artifactRoot, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const dependencyNames = Object.keys(artifactManifest.dependencies ?? {});
      expect(dependencyNames).toContain('@duckdb/node-api');

      const workspaceConfig = await readFile(join(artifactRoot, 'pnpm-workspace.yaml'), 'utf8');
      expect(workspaceConfig).toContain('nodeLinker: hoisted');

      const request = createRunRequest(manifest, {
        targetType: 'workflow',
        targetId: 'native-workflow',
        items: [{ id: 'native-item', input: { prompt: 'query native vectors' }, toolMocks: [] }],
        timeoutMs: 30_000,
      });
      const run = await runProtocol(artifactRoot, manifest, request);
      const completed = JSON.stringify(run.events.find(event => event.type === 'item-completed'));
      expect(completed).toContain('vec-native-a');
      expect(completed).toContain('"matchCount":1');
      expect(run.events.at(-1)?.payload).toMatchObject({ status: 'completed' });
      await recordAssertionEvidence(nativeDuckdbScenario, {
        'isolated-install-root': artifactRoot,
        'native-dependency-declared': dependencyNames,
        'portable-hoisted-layout': workspaceConfig,
        'artifact-relocated': artifactRoot,
        'native-vector-executed': completed,
      });
    },
    nativeDuckdbScenario.timeoutMs,
  );
});

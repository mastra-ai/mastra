import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { copyArtifact } from '../helpers/copy-artifact.js';
import { installNpmProject, installPnpmProject, installYarnProject } from '../helpers/install-project.js';
import { inspectManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest, runProtocol } from '../helpers/run-protocol.js';
import { npmMinimalScenario, pnpmMonorepoScenario, yarnMinimalScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

type Shape = {
  scenario: typeof npmMinimalScenario;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  expectedText: string;
};

const shapes: Shape[] = [
  { scenario: npmMinimalScenario, packageManager: 'npm', expectedText: 'hello from npm fixture' },
  { scenario: yarnMinimalScenario, packageManager: 'yarn', expectedText: 'hello from yarn fixture' },
  {
    scenario: pnpmMonorepoScenario,
    packageManager: 'pnpm',
    expectedText: 'hello from local workspace package',
  },
];

describe('experiment worker installed project shapes', () => {
  for (const shape of shapes) {
    test(
      `${shape.scenario.id} builds and executes from an isolated package-manager root`,
      async () => {
        const resources = new OwnedResources();
        try {
          const projectRoot = resources.trackPath(
            await materializeProject({
              fixtureDir: join(suiteRoot, 'fixtures', shape.scenario.fixture),
              runRoot: inject('runRoot'),
              registry: inject('registry'),
              tag: inject('tag'),
              scenarioId: shape.scenario.id,
            }),
          );

          const install =
            shape.packageManager === 'npm'
              ? await installNpmProject(projectRoot, inject('registry'))
              : shape.packageManager === 'yarn'
                ? await installYarnProject(projectRoot, inject('registry'))
                : await installPnpmProject(projectRoot, inject('registry'));
          if (shape.packageManager === 'yarn') {
            expect(await readFile(join(projectRoot, 'yarn.lock'), 'utf8')).toContain('experiment-worker-yarn-fixture');
          }

          const buildRoot = resources.trackPath(join(inject('runRoot'), 'builds', shape.scenario.id));
          const build = await buildWorker(projectRoot, buildRoot, shape.packageManager);
          const manifest = (await inspectManifest(build.artifactRoot)).manifest;
          const artifactRoot = resources.trackPath(
            await copyArtifact({
              artifactRoot: build.artifactRoot,
              destinationRoot: join(inject('artifactRoot'), shape.scenario.id),
              sourceRoots: [projectRoot, buildRoot, suiteRoot],
              deleteRoots: [projectRoot, buildRoot],
            }),
          );
          const request = createRunRequest(manifest, {
            targetType: 'agent',
            targetId: 'shape-agent',
            items: [{ id: `${shape.scenario.id}-item`, input: 'hello', toolMocks: [] }],
          });
          const run = await runProtocol(artifactRoot, manifest, request);
          expect(JSON.stringify(run.events.find(event => event.type === 'item-completed'))).toContain(
            shape.expectedText,
          );

          if (shape.packageManager === 'yarn') {
            expect(await readFile(join(artifactRoot, 'package.json'), 'utf8')).toContain('"type": "module"');
          }
          if (shape.packageManager === 'pnpm') {
            await expect(access(join(artifactRoot, 'node_modules'))).resolves.toBeUndefined();
          }

          const commonEvidence = {
            'isolated-install-root': projectRoot,
            'artifact-relocated': artifactRoot,
          };
          if (shape.scenario === npmMinimalScenario) {
            await recordAssertionEvidence(shape.scenario, {
              ...commonEvidence,
              'npm-install': install.exitCode,
              'minimal-environment': run.events.at(-1)?.payload,
            });
          } else if (shape.scenario === yarnMinimalScenario) {
            await recordAssertionEvidence(shape.scenario, {
              ...commonEvidence,
              'yarn-berry-node-modules': install.exitCode,
              'minimal-environment': run.events.at(-1)?.payload,
            });
          } else {
            await recordAssertionEvidence(shape.scenario, {
              ...commonEvidence,
              'workspace-package-imported': run.events.at(-1)?.payload,
              'source-independent': artifactRoot,
            });
          }
        } finally {
          const cleanup = await resources.cleanup();
          expect(cleanup.remainingPaths).toEqual([]);
        }
      },
      shape.scenario.timeoutMs,
    );
  }
});

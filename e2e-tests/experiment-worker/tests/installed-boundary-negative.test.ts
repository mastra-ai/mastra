import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest';
import { recordAssertionEvidence } from '../helpers/assertion-evidence.js';
import { buildWorker } from '../helpers/build-worker.js';
import { runCommand } from '../helpers/command.js';
import { installPnpmProject } from '../helpers/install-project.js';
import { inspectManifest } from '../helpers/inspect-manifest.js';
import { materializeProject } from '../helpers/materialize-project.js';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { createRunRequest } from '../helpers/run-protocol.js';
import { importFailureScenario, malformedApprovalsScenario, missingMastraScenario } from '../scenarios/index.js';

const suiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resources = new OwnedResources();
let projectRoot = '';
let workspaceSource = '';
let mastraSource = '';

async function expectBuildFailure(id: string, expected: RegExp) {
  const outputRoot = resources.trackPath(join(inject('runRoot'), 'negative-builds', id));
  await expect(buildWorker(projectRoot, outputRoot)).rejects.toThrow(expected);
}

async function expectStartupFailure(id: string, expected: RegExp) {
  const outputRoot = resources.trackPath(join(inject('runRoot'), 'negative-builds', id));
  const build = await buildWorker(projectRoot, outputRoot);
  const { manifest } = await inspectManifest(build.artifactRoot);
  const result = await runCommand(manifest.launch.executable, manifest.launch.arguments, {
    cwd: build.artifactRoot,
    timeoutMs: 30_000,
    stdin: `${JSON.stringify(createRunRequest(manifest))}\n`,
  });
  expect(result.exitCode).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toMatch(expected);
}

beforeAll(async () => {
  projectRoot = resources.trackPath(
    await materializeProject({
      fixtureDir: join(suiteRoot, 'fixtures', 'runtime'),
      runRoot: inject('runRoot'),
      registry: inject('registry'),
      tag: inject('tag'),
      scenarioId: 'installed-boundary-negative',
    }),
  );
  await installPnpmProject(projectRoot, inject('registry'));
  workspaceSource = await readFile(join(projectRoot, 'pnpm-workspace.yaml'), 'utf8');
  mastraSource = await readFile(join(projectRoot, 'src', 'mastra', 'index.ts'), 'utf8');
}, 240_000);

afterAll(async () => {
  const cleanup = await resources.cleanup();
  expect(cleanup.remainingPaths).toEqual([]);
});

describe('experiment worker installed-boundary diagnostics', () => {
  test('negative-malformed-approvals rejects unresolved pnpm build approval values', async () => {
    await writeFile(
      join(projectRoot, 'pnpm-workspace.yaml'),
      workspaceSource.replace('esbuild: true', 'esbuild: ${MISSING_EXPERIMENT_APPROVAL}'),
    );
    try {
      await expectBuildFailure('malformed-approvals', /Invalid pnpm allowBuilds entries: esbuild/);
      await recordAssertionEvidence(malformedApprovalsScenario, {
        'invalid-pnpm-approval-diagnostic': 'Invalid pnpm allowBuilds entries: esbuild',
      });
    } finally {
      await writeFile(join(projectRoot, 'pnpm-workspace.yaml'), workspaceSource);
    }
  });

  test('negative-missing-mastra reports a missing #mastra entrypoint', async () => {
    await writeFile(join(projectRoot, 'src', 'mastra', 'index.ts'), '');
    try {
      await expectStartupFailure('missing-mastra', /does not provide an export named ['"]mastra['"]/i);
      await recordAssertionEvidence(missingMastraScenario, {
        'missing-mastra-diagnostic': 'missing #mastra export',
      });
    } finally {
      await writeFile(join(projectRoot, 'src', 'mastra', 'index.ts'), mastraSource);
    }
  });

  test('negative-import-failure reports customer module evaluation failures', async () => {
    await writeFile(
      join(projectRoot, 'src', 'mastra', 'index.ts'),
      `throw new Error('fixture constructor import failure');\n`,
    );
    try {
      await expectStartupFailure('import-failure', /fixture constructor import failure/);
      await recordAssertionEvidence(importFailureScenario, {
        'customer-import-diagnostic': 'fixture constructor import failure',
      });
    } finally {
      await writeFile(join(projectRoot, 'src', 'mastra', 'index.ts'), mastraSource);
    }
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { glob as globby } from 'tinyglobby';
import type { TestProject } from 'vitest/node';
import {
  prepareMonorepo,
  publishPackages,
  setupPublishedRegistryFromEnv,
  startRegistry,
  stopRegistry,
} from '../_local-registry-setup/index.js';
import { getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';
import { computeRegistryArtifactDigest } from './helpers/registry-digest.js';

const suiteDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(suiteDir, '..', '..');
const localTag = 'experiment-worker-e2e-test';
const expectedPackages = ['mastra', '@mastra/core'] as const;

async function assertPublishedPackages(registry: string, tag: string) {
  for (const packageName of expectedPackages) {
    const version = execFileSync('npm', ['view', `${packageName}@${tag}`, 'version', '--registry', registry], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!version) {
      throw new Error(`Missing required published package ${packageName}@${tag} in ${registry}`);
    }
  }
}

export default async function setup(project: TestProject) {
  const runRoot = await mkdtemp(join(tmpdir(), 'mastra-experiment-worker-e2e-'));
  const artifactRoot = join(runRoot, 'artifacts');
  const reportRoot = process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR
    ? resolve(process.env.MASTRA_EXPERIMENT_E2E_REPORT_DIR)
    : join(runRoot, 'reports');
  await Promise.all([mkdir(artifactRoot, { recursive: true }), mkdir(reportRoot, { recursive: true })]);

  const hasPublishedRegistryEnv = Boolean(
    process.env.MASTRA_E2E_REGISTRY_STORAGE || process.env.MASTRA_E2E_REGISTRY_TAG,
  );
  let publishedRegistryTeardown: (() => Promise<void>) | null = null;

  try {
    const expectedDigest = process.env.MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST;
    let registryArtifactDigest: string | null = null;
    if (hasPublishedRegistryEnv) {
      const storageDir = process.env.MASTRA_E2E_REGISTRY_STORAGE;
      const tag = process.env.MASTRA_E2E_REGISTRY_TAG;
      if (!storageDir || !tag) {
        throw new Error('MASTRA_E2E_REGISTRY_STORAGE and MASTRA_E2E_REGISTRY_TAG must be set together');
      }
      if (process.env.MASTRA_EXPERIMENT_E2E_REQUIRE_PUBLISHED_REGISTRY === '1' && !expectedDigest) {
        throw new Error('Strict published-registry mode requires MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST');
      }

      const registryArtifactPath = process.env.MASTRA_E2E_REGISTRY_ARTIFACT_PATH;
      if (expectedDigest && !registryArtifactPath) {
        throw new Error('MASTRA_E2E_REGISTRY_ARTIFACT_PATH is required when validating the registry artifact digest');
      }
      registryArtifactDigest = await computeRegistryArtifactDigest(registryArtifactPath ?? dirname(storageDir));
      if (expectedDigest && registryArtifactDigest !== expectedDigest) {
        throw new Error(
          `Published registry artifact digest mismatch: expected ${expectedDigest}, received ${registryArtifactDigest}`,
        );
      }
    }

    publishedRegistryTeardown = await setupPublishedRegistryFromEnv(project);
    if (publishedRegistryTeardown) {
      const registry = `http://localhost:${Number(process.env.MASTRA_E2E_REGISTRY_PORT || 4873)}`;
      const tag = process.env.MASTRA_E2E_REGISTRY_TAG!;
      await assertPublishedPackages(registry, tag);

      project.provide('registryMode', 'published');
      project.provide('registryArtifactDigest', registryArtifactDigest);
      project.provide('runRoot', runRoot);
      project.provide('artifactRoot', artifactRoot);
      project.provide('reportRoot', reportRoot);

      return async () => {
        await publishedRegistryTeardown?.();
        await rm(runRoot, { recursive: true, force: true });
      };
    }

    if (process.env.MASTRA_EXPERIMENT_E2E_REQUIRE_PUBLISHED_REGISTRY === '1') {
      throw new Error('Published registry mode is required, but no published registry environment was provided');
    }
    if (hasPublishedRegistryEnv) {
      throw new Error('Published registry environment was provided but could not be started');
    }
  } catch (error) {
    await publishedRegistryTeardown?.();
    await rm(runRoot, { recursive: true, force: true });
    throw error;
  }

  const teardownMonorepo = await prepareMonorepo(rootDir, globby, localTag);
  const registryRoot = await mkdtemp(join(tmpdir(), 'mastra-experiment-worker-registry-'));
  let registry: Awaited<ReturnType<typeof startRegistry>> | undefined;

  try {
    execFileSync('pnpm', ['build:cli'], { cwd: rootDir, stdio: 'inherit' });
    const require = createRequire(import.meta.url);
    const verdaccioPackagePath = require.resolve('verdaccio/package.json');
    const verdaccioPath = join(dirname(verdaccioPackagePath), 'bin', 'verdaccio');
    await copyFile(
      join(rootDir, 'e2e-tests/_local-registry-setup/verdaccio.yaml'),
      join(registryRoot, 'verdaccio.yaml'),
    );
    registry = await startRegistry(verdaccioPath, await getPort(), registryRoot);
    await publishPackages(await getSuitePublishFilters(rootDir, 'experiment-worker'), localTag, rootDir, registry);

    const registryUrl = registry.toString();
    await assertPublishedPackages(registryUrl, localTag);
    project.provide('tag', localTag);
    project.provide('registry', registryUrl);
    project.provide('registryMode', 'local');
    project.provide('registryArtifactDigest', null);
    project.provide('runRoot', runRoot);
    project.provide('artifactRoot', artifactRoot);
    project.provide('reportRoot', reportRoot);
  } catch (error) {
    await stopRegistry(registry);
    await teardownMonorepo();
    await Promise.all([
      rm(registryRoot, { recursive: true, force: true }),
      rm(runRoot, { recursive: true, force: true }),
    ]);
    throw error;
  }

  return async () => {
    await stopRegistry(registry);
    await teardownMonorepo();
    await Promise.all([
      rm(registryRoot, { recursive: true, force: true }),
      rm(runRoot, { recursive: true, force: true }),
    ]);
  };
}

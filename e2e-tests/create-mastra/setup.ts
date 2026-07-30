import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import type { TestProject } from 'vitest/node';
import {
  prepareMonorepo,
  publishPackages,
  startPublishedRegistryFromEnv,
  startRegistry,
  stopRegistry,
} from '../_local-registry-setup/index.js';
import { getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const tag = 'create-mastra-e2e-test';
const generatedMastraPackages = [
  'mastra',
  '@mastra/core',
  '@mastra/duckdb',
  '@mastra/libsql',
  '@mastra/memory',
  '@mastra/observability',
] as const;

function getLocalPublishedVersions(): Record<string, string> {
  const packages = JSON.parse(
    execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], {
      cwd: rootDir,
      encoding: 'utf8',
    }),
  ) as Array<{ name?: string; version?: string }>;
  const versions = Object.fromEntries(
    packages
      .filter(pkg => pkg.name && generatedMastraPackages.includes(pkg.name as (typeof generatedMastraPackages)[number]))
      .map(pkg => [pkg.name, pkg.version]),
  );

  for (const packageName of generatedMastraPackages) {
    if (!versions[packageName]) {
      throw new Error(`Missing locally published version for ${packageName}`);
    }
  }

  return versions as Record<string, string>;
}

async function getRegistryPublishedVersions(registry: string, publishedTag: string): Promise<Record<string, string>> {
  const entries = await Promise.all(
    generatedMastraPackages.map(async packageName => {
      const result = await execa('npm', ['view', `${packageName}@${publishedTag}`, 'version', '--registry', registry]);
      const version = result.stdout.trim();
      if (!version) {
        throw new Error(`Missing ${packageName}@${publishedTag} in ${registry}`);
      }
      return [packageName, version] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export default async function setup({ provide }: TestProject) {
  const publishedRegistry = await startPublishedRegistryFromEnv();
  if (publishedRegistry) {
    try {
      const registryUrl = publishedRegistry.registry.toString();
      provide('tag', publishedRegistry.tag);
      provide('registry', registryUrl);
      provide('publishedVersions', await getRegistryPublishedVersions(registryUrl, publishedRegistry.tag));
      return async () => stopRegistry(publishedRegistry.registry);
    } catch (error) {
      await stopRegistry(publishedRegistry.registry);
      throw error;
    }
  }

  const { glob } = await import('tinyglobby');
  const teardown = await prepareMonorepo(rootDir, glob, tag);
  let registry: Awaited<ReturnType<typeof startRegistry>> | undefined;

  try {
    execFileSync('pnpm', ['--filter', './packages/cli', 'build:lib'], { cwd: rootDir, stdio: 'inherit' });
    execFileSync('pnpm', ['--filter', './packages/create-mastra', 'build'], { cwd: rootDir, stdio: 'inherit' });

    const { default: getPort } = await import('get-port');
    const port = await getPort();
    const require = createRequire(import.meta.url);
    const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
    const registryLocation = fileURLToPath(new URL('../_local-registry-setup/', import.meta.url));
    registry = await startRegistry(verdaccioPath, port, registryLocation);
    const registryUrl = registry.toString();
    console.log('registry', registryUrl);

    await publishPackages(await getSuitePublishFilters(rootDir, 'create-mastra'), tag, rootDir, registry);
    provide('tag', tag);
    provide('registry', registryUrl);
    provide('publishedVersions', getLocalPublishedVersions());
  } catch (error) {
    await stopRegistry(registry);
    await teardown();
    throw error;
  }

  return async () => {
    await stopRegistry(registry);
    await teardown();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
    publishedVersions: Record<string, string>;
  }
}

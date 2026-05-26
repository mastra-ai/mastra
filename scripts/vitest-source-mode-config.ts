import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserWorkspaceConfig } from 'vitest/config';

export function isRepoSourceModeEnabled() {
  return (
    process.env.MASTRA_SOURCE_MODE === '1' || ['1', 'true'].includes(process.env.MASTRA_REPO_RUN_FROM_SOURCE ?? '')
  );
}

export const SOURCE_MODE = isRepoSourceModeEnabled();
if (SOURCE_MODE) {
  process.env.MASTRA_SOURCE_MODE = '1';
}

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_MODE_CONDITIONS = ['mastra-source', 'node'];
export const SOURCE_MODE_WORKSPACE_DEPS = [/^@mastra\//, /^@internal\//, /^mastra$/];
export const SOURCE_MODE_WORKSPACE_PATH_DEPS = [new RegExp(REPO_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
export const SOURCE_MODE_ALIASES = {
  '@internal/test-utils/setup': resolve(REPO_ROOT, 'packages/_test-utils/src/setup.ts'),
};
export const SOURCE_MODE_PACKAGE_GLOBS = [
  'packages/*/package.json',
  'packages/_vendored/*/package.json',
  'stores/*/package.json',
  'deployers/*/package.json',
  'client-sdks/*/package.json',
  'server-adapters/*/package.json',
  'speech/*/package.json',
  'voice/*/package.json',
  'observability/*/package.json',
  'workflows/*/package.json',
  'pubsub/*/package.json',
  'integrations/*/package.json',
  'auth/*/package.json',
  'channels/*/package.json',
  'browser/*/package.json',
];
export const SOURCE_MODE_TEST_EXCLUDES = [
  '**/node_modules/**',
  '**/dist/**',
  'packages/core/src/workflows/workflow.test.ts',
  'src/workflows/workflow.test.ts',
  'src/workflows/evented/evented-workflow.test.ts',
  'src/storage/bundle.test.ts',
  'src/events/__tests__/per-thread-pubsub-multiprocess.test.ts',
  'src/workspace/lsp/servers.test.ts',
  'packages/deployer/src/build/analyze/analyzeEntry.test.ts',
  'packages/deployer/src/build/analyze.test.ts',
  'packages/editor/src/editor-integration-tools.test.ts',
  'src/editor-integration-tools.test.ts',
  'packages/schema-compat/src/provider-compats/*.e2e.test.ts',
  'src/provider-compats/*.e2e.test.ts',
  'stores/redis/src/**/*.test.ts',
  'src/build/analyze/analyzeEntry.test.ts',
  'src/build/analyze.test.ts',
];

const SOURCE_MODE_WORKSPACE_PACKAGES = new Map<string, { root: string; exports: Record<string, any> }>();

if (SOURCE_MODE) {
  for (const packageJsonPath of SOURCE_MODE_PACKAGE_GLOBS.flatMap(pattern => globSync(pattern, { cwd: REPO_ROOT }))) {
    const absolutePackageJsonPath = resolve(REPO_ROOT, packageJsonPath);
    const packageJson = JSON.parse(readFileSync(absolutePackageJsonPath, 'utf-8'));
    if (typeof packageJson.name === 'string' && packageJson.exports) {
      SOURCE_MODE_WORKSPACE_PACKAGES.set(packageJson.name, {
        root: dirname(absolutePackageJsonPath),
        exports: packageJson.exports,
      });
    }
  }
}

function sourceModeExportTarget(source: string) {
  for (const [packageName, packageConfig] of SOURCE_MODE_WORKSPACE_PACKAGES) {
    if (source !== packageName && !source.startsWith(`${packageName}/`)) continue;

    const subpath = source === packageName ? '.' : `.${source.slice(packageName.length)}`;
    const exactExport = packageConfig.exports[subpath];
    if (exactExport?.['mastra-source']) {
      return resolve(packageConfig.root, exactExport['mastra-source']);
    }

    for (const [exportPath, exportConfig] of Object.entries(packageConfig.exports) as Array<
      [string, Record<string, string>]
    >) {
      if (!exportPath.includes('*') || !exportConfig['mastra-source']) continue;

      const [exportPrefix = '', exportSuffix = ''] = exportPath.split('*');
      if (!subpath.startsWith(exportPrefix) || !subpath.endsWith(exportSuffix)) continue;

      const wildcard = subpath.slice(exportPrefix.length, subpath.length - exportSuffix.length);
      return resolve(packageConfig.root, exportConfig['mastra-source'].replace('*', wildcard));
    }
  }

  return null;
}

const sourceModeWorkspaceResolver = () => ({
  name: 'mastra-source-mode-workspace-resolver',
  enforce: 'pre' as const,
  resolveId(source: string) {
    if (!SOURCE_MODE || !SOURCE_MODE_WORKSPACE_DEPS.some(dep => dep.test(source))) {
      return null;
    }

    const target = sourceModeExportTarget(source);
    return target && existsSync(target) ? target : null;
  },
});

const sourceModeRelativeResolver = () => ({
  name: 'mastra-source-mode-relative-resolver',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!SOURCE_MODE || !importer || !source.startsWith('.') || !importer.includes('/src/')) {
      return null;
    }

    const importerDir = dirname(importer.replace(/^file:\/\//, ''));
    const base = resolve(importerDir, source);
    const candidates = source.endsWith('.js')
      ? [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')]
      : [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')];

    return candidates.find(candidate => existsSync(candidate)) ?? null;
  },
});

function sourceModeSetupFiles(setupFiles: any) {
  if (!setupFiles) return setupFiles;
  const files = Array.isArray(setupFiles) ? setupFiles : [setupFiles];
  const resolved = files.map(file =>
    file === '@internal/test-utils/setup' ? SOURCE_MODE_ALIASES['@internal/test-utils/setup'] : file,
  );
  return Array.isArray(setupFiles) ? resolved : resolved[0];
}

function sourceModeAlias(alias: any) {
  if (Array.isArray(alias)) {
    return [
      { find: '@internal/test-utils/setup', replacement: SOURCE_MODE_ALIASES['@internal/test-utils/setup'] },
      ...alias,
    ];
  }

  return {
    ...SOURCE_MODE_ALIASES,
    ...alias,
  };
}

function sourceModeDeps(project: UserWorkspaceConfig) {
  const projectName = String(project.test?.name ?? '');
  return projectName === 'unit:packages/editor'
    ? [...SOURCE_MODE_WORKSPACE_DEPS, ...SOURCE_MODE_WORKSPACE_PATH_DEPS]
    : SOURCE_MODE_WORKSPACE_DEPS;
}

function uniqueValues<T>(values: T[]) {
  return values.filter(
    (value, index, array) => array.findIndex(candidate => String(candidate) === String(value)) === index,
  );
}

function mergeArrayValue<T>(sourceValues: T[], existingValue: T | T[] | undefined) {
  const existingValues =
    existingValue === undefined ? [] : Array.isArray(existingValue) ? existingValue : [existingValue];
  return uniqueValues([...sourceValues, ...existingValues]);
}

function mergeNoExternal(sourceValues: Array<string | RegExp>, existingValue: any) {
  if (existingValue === true) return true;
  return mergeArrayValue(sourceValues, existingValue);
}

function mergeInlineDeps(sourceValues: Array<string | RegExp>, existingValue: any) {
  if (existingValue === true) return true;
  return mergeArrayValue(sourceValues, existingValue);
}

export function sourceModeConfigFor(project: UserWorkspaceConfig = {}): UserWorkspaceConfig {
  if (!SOURCE_MODE) return {};

  const deps = sourceModeDeps(project);

  return {
    plugins: [sourceModeWorkspaceResolver(), sourceModeRelativeResolver()],
    resolve: {
      conditions: SOURCE_MODE_CONDITIONS,
      alias: SOURCE_MODE_ALIASES,
    },
    ssr: {
      noExternal: deps,
      resolve: {
        conditions: SOURCE_MODE_CONDITIONS,
        externalConditions: SOURCE_MODE_CONDITIONS,
      },
    },
    test: {
      exclude: SOURCE_MODE_TEST_EXCLUDES,
      setupFiles: sourceModeSetupFiles(project.test?.setupFiles),
      server: {
        deps: {
          inline: deps,
        },
      },
    },
  };
}

function mergeSourceModeConfig<T extends UserWorkspaceConfig>(config: T): T {
  const sourceConfig = sourceModeConfigFor(config);
  const deps = sourceModeDeps(config);

  return {
    ...config,
    plugins: [...(sourceConfig.plugins ?? []), ...(config.plugins ?? [])],
    resolve: {
      ...sourceConfig.resolve,
      ...config.resolve,
      conditions: mergeArrayValue(SOURCE_MODE_CONDITIONS, config.resolve?.conditions),
      alias: sourceModeAlias(config.resolve?.alias),
    },
    ssr: {
      ...sourceConfig.ssr,
      ...config.ssr,
      noExternal: mergeNoExternal(deps, config.ssr?.noExternal),
      resolve: {
        ...sourceConfig.ssr?.resolve,
        ...config.ssr?.resolve,
        conditions: mergeArrayValue(SOURCE_MODE_CONDITIONS, config.ssr?.resolve?.conditions),
        externalConditions: mergeArrayValue(SOURCE_MODE_CONDITIONS, config.ssr?.resolve?.externalConditions),
      },
    },
    test: {
      ...sourceConfig.test,
      ...config.test,
      exclude: [...(config.test?.exclude ?? []), ...SOURCE_MODE_TEST_EXCLUDES],
      setupFiles: sourceModeSetupFiles(config.test?.setupFiles),
      server: {
        ...sourceConfig.test?.server,
        ...config.test?.server,
        deps: {
          ...sourceConfig.test?.server?.deps,
          ...config.test?.server?.deps,
          inline: mergeInlineDeps(deps, config.test?.server?.deps?.inline),
        },
      },
    },
  };
}

export function withSourceModeConfig<T extends UserWorkspaceConfig>(config: T): T {
  if (!SOURCE_MODE) return config;

  const sourceModeConfig = mergeSourceModeConfig(config);
  return {
    ...sourceModeConfig,
    test: {
      ...sourceModeConfig.test,
      projects: sourceModeConfig.test?.projects
        ?.filter(
          project =>
            typeof project === 'string' ||
            !String((project as UserWorkspaceConfig).test?.name ?? '').startsWith('typecheck:'),
        )
        .map(project =>
          typeof project === 'string' ? project : mergeSourceModeConfig(project as UserWorkspaceConfig),
        ),
    },
  };
}

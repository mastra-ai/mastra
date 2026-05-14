import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { UserWorkspaceConfig } from 'vitest/config';

const SOURCE_MODE = process.env.MASTRA_SOURCE_MODE === '1';
const SOURCE_MODE_CONDITIONS = ['mastra-source', 'node'];
const SOURCE_MODE_WORKSPACE_DEPS = [/^@mastra\//, /^@internal\//, /^mastra$/];
const SOURCE_MODE_ALIASES = {
  '@internal/test-utils/setup': resolve(process.cwd(), 'packages/_test-utils/src/setup.ts'),
};
const SOURCE_MODE_PACKAGE_GLOBS = [
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
];
const SOURCE_MODE_WORKSPACE_PACKAGES = new Map<string, { root: string; exports: Record<string, any> }>();
const SOURCE_MODE_TEST_EXCLUDES = [
  '**/node_modules/**',
  '**/dist/**',
  'packages/core/src/workflows/workflow.test.ts',
  'src/workflows/workflow.test.ts',
  'src/workflows/evented/evented-workflow.test.ts',
  'src/storage/bundle.test.ts',
  'src/workspace/lsp/servers.test.ts',
  'packages/deployer/src/build/analyze/analyzeEntry.test.ts',
  'src/build/analyze/analyzeEntry.test.ts',
];

if (SOURCE_MODE) {
  for (const packageJsonPath of SOURCE_MODE_PACKAGE_GLOBS.flatMap(pattern => globSync(pattern))) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    if (typeof packageJson.name === 'string' && packageJson.exports) {
      SOURCE_MODE_WORKSPACE_PACKAGES.set(packageJson.name, {
        root: dirname(packageJsonPath),
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

      const [exportPrefix, exportSuffix] = exportPath.split('*');
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

function sourceModeSetupFiles(setupFiles: any) {
  if (!setupFiles) return setupFiles;
  const files = Array.isArray(setupFiles) ? setupFiles : [setupFiles];
  const resolved = files.map(file =>
    file === '@internal/test-utils/setup' ? SOURCE_MODE_ALIASES['@internal/test-utils/setup'] : file,
  );
  return Array.isArray(setupFiles) ? resolved : resolved[0];
}

export function withSourceModeConfig<T extends UserWorkspaceConfig>(config: T): T {
  if (!SOURCE_MODE) return config;

  return {
    ...config,
    plugins: [sourceModeWorkspaceResolver(), ...(config.plugins ?? [])],
    resolve: {
      conditions: SOURCE_MODE_CONDITIONS,
      ...config.resolve,
      alias: Array.isArray(config.resolve?.alias)
        ? config.resolve.alias
        : {
            ...SOURCE_MODE_ALIASES,
            ...config.resolve?.alias,
          },
    },
    ssr: {
      noExternal: SOURCE_MODE_WORKSPACE_DEPS,
      ...config.ssr,
      resolve: {
        conditions: SOURCE_MODE_CONDITIONS,
        externalConditions: SOURCE_MODE_CONDITIONS,
        ...config.ssr?.resolve,
      },
    },
    test: {
      ...config.test,
      exclude: [...(config.test?.exclude ?? []), ...SOURCE_MODE_TEST_EXCLUDES],
      setupFiles: sourceModeSetupFiles(config.test?.setupFiles),
      server: {
        ...config.test?.server,
        deps: {
          ...config.test?.server?.deps,
          inline: SOURCE_MODE_WORKSPACE_DEPS,
        },
      },
    },
  };
}

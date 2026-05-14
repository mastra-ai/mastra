import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';
import type { TestProjectConfiguration, UserWorkspaceConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const SOURCE_MODE = process.env.MASTRA_SOURCE_MODE === '1';
const SOURCE_MODE_CONDITIONS = ['mastra-source', 'node'];
const SOURCE_MODE_WORKSPACE_DEPS = [/^@mastra\//, /^@internal\//, /^mastra$/];
const SOURCE_MODE_WORKSPACE_PATH_DEPS = [new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
const SOURCE_MODE_ALIASES = {
  '@internal/test-utils/setup': resolve(process.cwd(), 'packages/_test-utils/src/setup.ts'),
};
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

const SOURCE_MODE_CONFIG: UserWorkspaceConfig = SOURCE_MODE
  ? {
      plugins: [sourceModeRelativeResolver()],
      resolve: {
        conditions: SOURCE_MODE_CONDITIONS,
      },
      ssr: {
        noExternal: SOURCE_MODE_WORKSPACE_DEPS,
        resolve: {
          conditions: SOURCE_MODE_CONDITIONS,
          externalConditions: SOURCE_MODE_CONDITIONS,
        },
      },
      test: {
        server: {
          deps: {
            inline: SOURCE_MODE_WORKSPACE_DEPS,
          },
        },
      },
    }
  : {};

function sourceModeSetupFiles(setupFiles: any) {
  if (!setupFiles) return setupFiles;
  const files = Array.isArray(setupFiles) ? setupFiles : [setupFiles];
  const resolved = files.map(file =>
    file === '@internal/test-utils/setup' ? SOURCE_MODE_ALIASES['@internal/test-utils/setup'] : file,
  );
  return Array.isArray(setupFiles) ? resolved : resolved[0];
}

function withSourceModeConfig(project: UserWorkspaceConfig): UserWorkspaceConfig {
  if (!SOURCE_MODE) return project;

  const projectName = String(project.test?.name ?? '');
  const sourceModeDeps =
    projectName === 'unit:packages/editor'
      ? [...SOURCE_MODE_WORKSPACE_DEPS, ...SOURCE_MODE_WORKSPACE_PATH_DEPS]
      : SOURCE_MODE_WORKSPACE_DEPS;

  return {
    ...project,
    plugins: [...(SOURCE_MODE_CONFIG.plugins ?? []), ...(project.plugins ?? [])],
    resolve: {
      ...SOURCE_MODE_CONFIG.resolve,
      ...project.resolve,
      conditions: SOURCE_MODE_CONDITIONS,
      alias: Array.isArray(project.resolve?.alias)
        ? project.resolve.alias
        : {
            ...SOURCE_MODE_ALIASES,
            ...project.resolve?.alias,
          },
    },
    ssr: {
      ...SOURCE_MODE_CONFIG.ssr,
      ...project.ssr,
      noExternal: sourceModeDeps,
      resolve: {
        ...SOURCE_MODE_CONFIG.ssr?.resolve,
        ...project.ssr?.resolve,
        conditions: SOURCE_MODE_CONDITIONS,
        externalConditions: SOURCE_MODE_CONDITIONS,
      },
    },
    test: {
      ...SOURCE_MODE_CONFIG.test,
      ...project.test,
      setupFiles: sourceModeSetupFiles(project.test?.setupFiles),
      server: {
        ...SOURCE_MODE_CONFIG.test?.server,
        ...project.test?.server,
        deps: {
          ...SOURCE_MODE_CONFIG.test?.server?.deps,
          ...project.test?.server?.deps,
          inline: sourceModeDeps,
        },
      },
    },
  };
}

// Directories to exclude from project discovery
const EXCLUDED_DIRS = new Set([
  'packages/_config',
  'packages/_types-builder',
  'packages/_vendored',
  'packages/playground',
  'packages/playground-ui',
  'server-adapters/_test-utils',
  'observability/_examples',
  ...(SOURCE_MODE
    ? [
        'observability/_test-utils',
        'stores/redis',
        'workflows/inngest',
        'workflows/temporal',
        'packages/_external-types',
        'packages/_changeset-cli',
        'packages/_internal-core',
      ]
    : []),
]);

const REQUESTED_PROJECTS = new Set(
  process.argv.flatMap((arg, index, args) => {
    if (arg === '--project') return args[index + 1] ? [args[index + 1]] : [];
    if (arg.startsWith('--project=')) return [arg.slice('--project='.length)];
    return [];
  }),
);

function shouldScanProjectGroup(projectGroup: string) {
  if (!SOURCE_MODE || REQUESTED_PROJECTS.size === 0) return true;
  return [...REQUESTED_PROJECTS].some(
    project => project === `unit:${projectGroup}/*` || project === `e2e:${projectGroup}/*`,
  );
}

// Directories to scan for vitest configs
const PROJECT_GLOBS = [
  ...(shouldScanProjectGroup('packages') ? ['packages/*/vitest.config.ts'] : []),
  ...(SOURCE_MODE || !shouldScanProjectGroup('stores') ? [] : ['stores/*/vitest.config.ts']),
  ...(shouldScanProjectGroup('deployers') ? ['deployers/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('voice') ? ['voice/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('server-adapters') ? ['server-adapters/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('client-sdks') ? ['client-sdks/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('auth') ? ['auth/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('observability') ? ['observability/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('pubsub') ? ['pubsub/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('workflows') ? ['workflows/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('workspaces') ? ['workspaces/*/vitest.config.ts'] : []),
];

/**
 * Discovers all vitest projects from package configs.
 * For configs with nested projects, expands them with the correct root path.
 * For simple configs, returns the directory as a project path.
 */
async function discoverProjects(): Promise<TestProjectConfiguration[]> {
  const projects: TestProjectConfiguration[] = [];

  // Find all vitest.config.ts files
  const configPaths = PROJECT_GLOBS.flatMap(pattern => globSync(pattern));

  for (const configPath of configPaths) {
    const projectDir = dirname(configPath);

    // Skip excluded directories
    if (EXCLUDED_DIRS.has(projectDir)) {
      continue;
    }

    // Read the config file to check if it has nested projects
    const configContent = readFileSync(configPath, 'utf-8');
    const hasNestedProjects = /test:\s*\{[\s\S]*?projects:\s*\[/.test(configContent);

    try {
      const absolutePath = resolve(process.cwd(), configPath);
      const loaded = await loadConfigFromFile({} as any, absolutePath);
      if (!loaded) {
        projects.push(projectDir);
        continue;
      }
      const config = loaded.config as UserWorkspaceConfig;

      if (!hasNestedProjects) {
        projects.push(
          withSourceModeConfig({
            ...config,
            test: {
              ...config.test,
              name: config.test?.name ?? `unit:${projectDir}`,
              root: `./${projectDir}`,
              exclude: SOURCE_MODE
                ? [...(config.test?.exclude ?? []), ...SOURCE_MODE_TEST_EXCLUDES]
                : config.test?.exclude,
            },
          }),
        );
        continue;
      }

      if (!config.test?.projects) {
        // Fallback if config parsing didn't work as expected
        projects.push(projectDir);
        continue;
      }

      // Expand nested projects with root path
      for (const nestedProject of config.test.projects) {
        if (typeof nestedProject === 'string') {
          // String reference - resolve relative to the config's directory
          projects.push(`${projectDir}/${nestedProject}`);
        } else {
          // Inline project config - add root path
          const projectConfig = nestedProject as UserWorkspaceConfig;
          projects.push(
            withSourceModeConfig({
              ...projectConfig,
              test: {
                ...projectConfig.test,
                name: projectConfig.test?.name ?? `unit:${projectDir}`,
                root: `./${projectDir}`,
                exclude: SOURCE_MODE
                  ? [...(projectConfig.test?.exclude ?? []), ...SOURCE_MODE_TEST_EXCLUDES]
                  : projectConfig.test?.exclude,
              },
            }),
          );
        }
      }
    } catch (error) {
      // If we can't import the config, fall back to using the directory path
      console.warn(`Warning: Could not import ${configPath}, using directory path instead:`, error);
      projects.push(projectDir);
    }
  }

  return projects;
}

export default defineConfig(async () => ({
  test: {
    projects: await discoverProjects(),
  },
}));

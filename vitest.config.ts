import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';
import type { TestProjectConfiguration, UserWorkspaceConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

import { SOURCE_MODE, sourceModeConfigFor, withSourceModeConfig } from './scripts/vitest-source-mode-config';

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
    ? ['observability/_test-utils', 'packages/_changeset-cli', 'packages/_external-types', 'packages/_internal-core']
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
    project =>
      project === `unit:${projectGroup}/*` ||
      project === `e2e:${projectGroup}/*` ||
      project.startsWith(`unit:${projectGroup}/`) ||
      project.startsWith(`e2e:${projectGroup}/`),
  );
}

// Directories to scan for vitest configs
const PROJECT_GLOBS = [
  ...(shouldScanProjectGroup('packages') ? ['packages/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('stores') ? ['stores/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('deployers') ? ['deployers/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('voice') ? ['voice/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('speech') ? ['speech/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('server-adapters') ? ['server-adapters/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('client-sdks') ? ['client-sdks/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('auth') ? ['auth/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('observability') ? ['observability/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('pubsub') ? ['pubsub/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('workflows') ? ['workflows/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('workspaces') ? ['workspaces/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('integrations') ? ['integrations/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('channels') ? ['channels/*/vitest.config.ts'] : []),
  ...(shouldScanProjectGroup('browser') ? ['browser/*/vitest.config.ts'] : []),
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
        if (!SOURCE_MODE) {
          projects.push(projectDir);
          continue;
        }

        projects.push(
          withSourceModeConfig({
            ...config,
            test: {
              ...config.test,
              name: config.test?.name ?? `unit:${projectDir}`,
              root: `./${projectDir}`,
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
                ...(SOURCE_MODE && !projectConfig.test?.name ? { name: `unit:${projectDir}` } : {}),
                root: `./${projectDir}`,
                ...(projectConfig.test?.exclude ? { exclude: projectConfig.test.exclude } : {}),
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

export default defineConfig(async () => {
  const sourceConfig = sourceModeConfigFor();

  return {
    ...sourceConfig,
    test: {
      ...sourceConfig.test,
      projects: await discoverProjects(),
    },
  };
});

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';
import type { TestProjectConfiguration, UserWorkspaceConfig } from 'vitest/config';
import { configDefaults, defineConfig } from 'vitest/config';

// Directories to exclude from project discovery
const EXCLUDED_DIRS = new Set([
  'packages/_config',
  'packages/_types-builder',
  'packages/_vendored',
  'server-adapters/server-adapters-test-suite',
  'browser/_test-utils',
  'workspaces/_test-utils',
  'observability/_examples',
  // Standalone private app: not a pnpm workspace member, so its dependencies
  // are never installed and its suite cannot resolve them (e.g. `hono`).
  'mastracode/web',
]);

// Directories to scan for vitest configs
const PROJECT_GLOBS = [
  'packages/*/vitest.config.ts',
  'packages/playground/vercel-preview/vitest.config.ts',
  'stores/*/vitest.config.ts',
  'deployers/*/vitest.config.ts',
  'voice/*/vitest.config.ts',
  'server-adapters/*/vitest.config.ts',
  'client-sdks/*/vitest.config.ts',
  'auth/*/vitest.config.ts',
  'observability/*/vitest.config.ts',
  'pubsub/*/vitest.config.ts',
  'signals/*/vitest.config.ts',
  'workflows/*/vitest.config.ts',
  'code-mode/*/vitest.config.ts',
  'integrations/*/vitest.config.ts',
  'channels/*/vitest.config.ts',
  'browser/*/vitest.config.ts',
  'workspaces/*/vitest.config.ts',
  'agent-sdks/*/vitest.config.ts',
  'mastracode/*/vitest.config.ts',
];

/**
 * Discovers all vitest projects from package configs.
 * For configs with nested projects, expands them with the correct root path.
 * For simple configs, returns the directory as a project path.
 */
async function discoverProjects(): Promise<TestProjectConfiguration[]> {
  const projects: TestProjectConfiguration[] = [];

  // Find all vitest.config.ts files
  const configPaths = PROJECT_GLOBS.flatMap(pattern => {
    const matches = globSync(pattern);
    if (matches.length === 0) {
      throw new Error(`Vitest project glob matched no configs: ${pattern}`);
    }
    return matches;
  });

  for (const configPath of configPaths) {
    const projectDir = dirname(configPath);

    // Skip excluded directories
    if (EXCLUDED_DIRS.has(projectDir)) {
      continue;
    }

    // Match workspace test:unit scripts; integration suites keep their package-local CI jobs.
    if (projectDir.startsWith('workspaces/')) {
      projects.push({
        extends: resolve(configPath),
        test: {
          name: `unit:${projectDir}`,
          root: resolve(projectDir),
          exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
        },
      });
      continue;
    }

    // Read the config file to check if it has nested projects
    const configContent = readFileSync(configPath, 'utf-8');
    const hasNestedProjects = /test:\s*\{[\s\S]*?projects:\s*\[/.test(configContent);

    if (!hasNestedProjects) {
      // Simple config - use directory path
      projects.push(projectDir);
      continue;
    }

    // Config has nested projects - load it using Vite's config loader
    try {
      const absolutePath = resolve(process.cwd(), configPath);
      const loaded = await loadConfigFromFile({} as any, absolutePath);
      if (!loaded) {
        projects.push(projectDir);
        continue;
      }
      const config = loaded.config as UserWorkspaceConfig;

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
          projects.push({
            ...projectConfig,
            test: {
              ...projectConfig.test,
              root: `./${projectDir}`,
            },
          });
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

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CreateProjectOptions {
  /** Template directory path (relative to templates/) */
  template: string;
  /** Custom name prefix for the temp directory */
  namePrefix?: string;
  /** Registry URL for installing dependencies */
  registryUrl?: string;
  /** Package manager to use (default: 'pnpm') */
  packageManager?: 'pnpm' | 'npm' | 'yarn';
  /** Additional environment variables for install */
  env?: Record<string, string>;
  /** Timeout for install in milliseconds (default: 5 minutes) */
  installTimeout?: number;
}

export interface TestProject {
  /** Absolute path to the project directory */
  path: string;
  /** Clean up the project directory */
  cleanup: () => Promise<void>;
  /** Run a command in the project directory */
  run: (command: string, args?: string[], options?: RunOptions) => ReturnType<typeof spawnSync>;
}

export interface RunOptions {
  env?: Record<string, string>;
  timeout?: number;
  stdio?: 'inherit' | 'pipe';
}

/**
 * Create a test project from a template.
 *
 * This function:
 * 1. Creates a temporary directory
 * 2. Copies the template into it
 * 3. Installs dependencies using the specified registry
 *
 * @example
 * ```ts
 * const project = await createProject({
 *   template: 'monorepo',
 *   registryUrl: 'http://localhost:4873',
 * });
 *
 * // Run tests against project.path
 * // ...
 *
 * await project.cleanup();
 * ```
 */
export async function createProject(options: CreateProjectOptions): Promise<TestProject> {
  const {
    template,
    namePrefix = 'mastra-e2e',
    registryUrl,
    packageManager = 'pnpm',
    env = {},
    installTimeout = 5 * 60 * 1000,
  } = options;

  // Create temp directory
  const projectPath = await mkdtemp(join(tmpdir(), `${namePrefix}-`));

  // Resolve template path
  const templatePath = join(__dirname, '..', '..', 'templates', template);

  // Copy template
  await cp(templatePath, projectPath, { recursive: true });

  // Build environment
  const installEnv = {
    ...process.env,
    ...env,
  };

  if (registryUrl) {
    installEnv.npm_config_registry = registryUrl;
  }

  // Install dependencies
  console.log(`[createProject] Installing dependencies in ${projectPath}`);
  const installResult = spawnSync(packageManager, ['install'], {
    cwd: projectPath,
    stdio: 'inherit',
    shell: true,
    env: installEnv,
    timeout: installTimeout,
  });

  if (installResult.error) {
    await rm(projectPath, { recursive: true, force: true });
    throw new Error(`Install failed: ${installResult.error.message}`);
  }

  if (installResult.status !== 0) {
    await rm(projectPath, { recursive: true, force: true });
    throw new Error(`Install failed with exit code ${installResult.status}`);
  }

  // Return project handle
  return {
    path: projectPath,
    cleanup: async () => {
      await rm(projectPath, { recursive: true, force: true });
    },
    run: (command, args = [], runOptions = {}) => {
      return spawnSync(command, args, {
        cwd: projectPath,
        stdio: runOptions.stdio ?? 'inherit',
        shell: true,
        env: {
          ...process.env,
          ...env,
          ...runOptions.env,
        },
        timeout: runOptions.timeout,
      });
    },
  };
}

/**
 * Patch a package.json file in a project.
 *
 * Useful for modifying dependencies or scripts before running tests.
 *
 * @example
 * ```ts
 * await patchPackageJson(project.path, (pkg) => {
 *   pkg.dependencies['@mastra/core'] = 'latest';
 *   return pkg;
 * });
 * ```
 */
export async function patchPackageJson(
  projectPath: string,
  patcher: (pkg: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const pkgPath = join(projectPath, 'package.json');
  const content = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(content);
  const patched = patcher(pkg);
  await writeFile(pkgPath, JSON.stringify(patched, null, 2));
}

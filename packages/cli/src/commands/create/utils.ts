import child_process from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps.js';
import { getPackageManagerAddCommand } from '../../utils/package-manager.js';
import type { PackageManager } from '../../utils/package-manager.js';
import { interactivePrompt } from '../init/utils.js';
import type { LLMProvider } from '../init/utils.js';
import { getPackageManager } from '../utils.js';

const exec = util.promisify(child_process.exec);

const execWithTimeout = async (command: string, timeoutMs?: number) => {
  try {
    const promise = exec(command, { killSignal: 'SIGTERM' });

    if (!timeoutMs) {
      return await promise;
    }

    let timeoutId: NodeJS.Timeout;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Command timed out')), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeout]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      if (error instanceof Error && error.message === 'Command timed out') {
        throw new Error('Something went wrong during installation, please try again.');
      }
      throw error;
    }
  } catch (error: unknown) {
    throw error;
  }
};

async function getInitCommand(pm: PackageManager): Promise<string> {
  switch (pm) {
    case 'npm':
      return 'npm init -y';
    case 'pnpm':
      return 'pnpm init';
    case 'yarn':
      return 'yarn init -y';
    case 'bun':
      return 'bun init -y';
    default:
      return 'npm init -y';
  }
}

async function initializePackageJson(pm: PackageManager): Promise<void> {
  // Run the init command
  const initCommand = await getInitCommand(pm);
  await exec(initCommand);

  // Read and update package.json directly (more reliable than pkg set)
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

  packageJson.type = 'module';
  packageJson.engines = {
    ...packageJson.engines,
    node: '>=22.13.0',
  };

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function installMastraDependency(
  pm: PackageManager,
  dependency: string,
  versionTag: string,
  isDev: boolean,
  timeout?: number,
) {
  let installCommand = getPackageManagerAddCommand(pm);

  if (isDev) {
    /**
     * All our package managers support -D for devDependencies. We can't use --save-dev across the board because yarn and bun don't alias it.
     * npm: -D, --save-dev. pnpm: -D, --save-dev. yarn: -D, --dev. bun: -D, --dev
     */
    installCommand = `${installCommand} -D`;
  }

  try {
    await execWithTimeout(`${pm} ${installCommand} ${dependency}${versionTag}`, timeout);
  } catch (err) {
    if (versionTag === '@latest') {
      throw new Error(
        `Failed to install ${dependency}@latest: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
    try {
      await execWithTimeout(`${pm} ${installCommand} ${dependency}@latest`, timeout);
    } catch (fallbackErr) {
      throw new Error(
        `Failed to install ${dependency} (tried ${versionTag} and @latest): ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`,
      );
    }
  }
}

export const createMastraProject = async ({
  projectName: name,
  createVersionTag,
  timeout,
  llmProvider,
  llmApiKey,
  needsInteractive,
}: {
  projectName?: string;
  createVersionTag?: string;
  timeout?: number;
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  needsInteractive?: boolean;
}) => {
  p.intro(color.inverse(' Mastra Create '));

  const projectName =
    name ??
    (await p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-app',
      defaultValue: 'my-mastra-app',
      validate: value => {
        if (value.length === 0) return 'Project name cannot be empty';
        if (fsSync.existsSync(value)) {
          return `A directory named "${value}" already exists. Please choose a different name.`;
        }
      },
    }));

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  let result: Awaited<ReturnType<typeof interactivePrompt>> | undefined = undefined;

  if (needsInteractive) {
    result = await interactivePrompt({
      options: { showBanner: false },
      skip: { llmProvider: llmProvider !== undefined, llmApiKey: llmApiKey !== undefined },
    });
  }
  const s = p.spinner();
  const originalCwd = process.cwd();
  let projectPath: string | null = null;

  try {
    s.start('Creating project');
    try {
      await fs.mkdir(projectName);
      projectPath = path.resolve(originalCwd, projectName);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        s.stop(`A directory named "${projectName}" already exists. Please choose a different name.`);
        process.exit(1);
      }
      throw new Error(
        `Failed to create project directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    process.chdir(projectName);
    const pm = getPackageManager();
    const installCommand = getPackageManagerAddCommand(pm);

    s.message('Initializing project structure');
    try {
      await initializePackageJson(pm);
      const depsService = new DepsService();
      await depsService.addScriptsToPackageJson({
        dev: 'mastra dev',
        build: 'mastra build',
        start: 'mastra start',
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize project structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    s.stop('Project structure created');

    s.start(`Installing ${pm} dependencies`);
    try {
      await exec(`${pm} ${installCommand} zod@^4`);
      await exec(`${pm} ${installCommand} -D typescript @types/node`);
      await exec(`echo '{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": [
    "src/**/*"
  ]
}' > tsconfig.json`);
    } catch (error) {
      throw new Error(
        `Failed to install basic dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    s.stop(`${pm} dependencies installed`);

    s.start('Installing Mastra CLI');
    const versionTag = createVersionTag ? `@${createVersionTag}` : '@latest';

    try {
      await installMastraDependency(pm, 'mastra', versionTag, true, timeout);
    } catch (error) {
      throw new Error(`Failed to install Mastra CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    s.stop('Mastra CLI installed');

    s.start('Installing Mastra dependencies');
    try {
      await installMastraDependency(pm, '@mastra/core', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/libsql', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/memory', versionTag, false, timeout);

      // Bun workaround: Bun doesn't respect npm's deprecated flag, which can cause
      // incorrect versions to be installed. Explicitly install @mastra/server to
      // ensure the correct version is used.
      // See: https://github.com/oven-sh/bun/issues/25314
      if (pm === 'bun') {
        await installMastraDependency(pm, '@mastra/server', versionTag, false, timeout);
      }
    } catch (error) {
      throw new Error(
        `Failed to install Mastra dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    s.stop('Mastra dependencies installed');

    s.start('Adding .gitignore');
    try {
      await exec(`echo output.txt >> .gitignore`);
      await exec(`echo node_modules >> .gitignore`);
      await exec(`echo dist >> .gitignore`);
      await exec(`echo .mastra >> .gitignore`);
      await exec(`echo .env.development >> .gitignore`);
      await exec(`echo .env >> .gitignore`);
      await exec(`echo *.db >> .gitignore`);
      await exec(`echo *.db-* >> .gitignore`);
    } catch (error) {
      throw new Error(`Failed to create .gitignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    s.stop('.gitignore added');

    p.outro('Project created successfully');
    console.info('');

    // Show Bun-specific tips if running under Bun
    if (pm === 'bun') {
      console.info('🥟 Bun detected! Your project is ready to use with Bun.');
      console.info('');
      console.info('For faster builds, you can optionally add the Bun bundler:');
      console.info('  bun add @mastra/bundler-bun');
      console.info('');
      console.info('Then configure it in src/mastra/index.ts:');
      console.info('  import { createBunEngine } from "@mastra/bundler-bun";');
      console.info('  export const mastra = new Mastra({');
      console.info('    bundler: { engine: createBunEngine() },');
      console.info('    // ... other config');
      console.info('  });');
      console.info('');
    }

    return { projectName, result };
  } catch (error) {
    s.stop();

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    p.cancel(`Project creation failed: ${errorMessage}`);

    // Clean up: remove the created directory on failure
    if (projectPath && fsSync.existsSync(projectPath)) {
      try {
        // Change back to original directory before cleanup
        process.chdir(originalCwd);
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        // Log but don't throw - we want to exit with the original error
        console.error(
          `Warning: Failed to clean up project directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
        );
      }
    }

    process.exit(1);
  }
};

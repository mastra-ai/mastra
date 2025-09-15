import fs from 'fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps.js';
import { getPackageManagerAddCommand } from '../../utils/package-manager.js';
import type { PackageManager } from '../../utils/package-manager.js';
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
}: {
  projectName?: string;
  createVersionTag?: string;
  timeout?: number;
}) => {
  p.intro(color.inverse(' Mastra Create '));

  const projectName =
    name ??
    (await p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-app',
      defaultValue: 'my-mastra-app',
    }));

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const s = p.spinner();

  try {
    s.start('Creating project');
    try {
      await fs.mkdir(projectName);
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
      await exec(`npm init -y`);
      await exec(`npm pkg set type="module"`);
      await exec(`npm pkg set engines.node=">=20.9.0"`);
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
      await exec(`${pm} ${installCommand} zod@^3`);
      await exec(`${pm} ${installCommand} typescript @types/node --save-dev`);
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

    s.start('Installing mastra');
    const versionTag = createVersionTag ? `@${createVersionTag}` : '@latest';

    try {
      await installMastraDependency(pm, 'mastra', versionTag, true, timeout);
    } catch (error) {
      throw new Error(`Failed to install Mastra CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    s.stop('mastra installed');

    s.start('Installing dependencies');
    try {
      await installMastraDependency(pm, '@mastra/core', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/libsql', versionTag, false, timeout);
      await installMastraDependency(pm, '@mastra/memory', versionTag, false, timeout);
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
    console.log('');

    return { projectName };
  } catch (error) {
    s.stop();

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    p.cancel(`Project creation failed: ${errorMessage}`);

    process.exit(1);
  }
};

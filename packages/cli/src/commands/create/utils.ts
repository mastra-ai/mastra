import fs from 'fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps.js';
import { getPackageManager, getPackageManagerInstallCommand } from '../utils.js';

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
    console.error(error);
    throw error;
  }
};

async function installMastraDependency(
  pm: string,
  dependency: string,
  versionTag: string,
  isDev: boolean,
  timeout?: number,
) {
  let installCommand = getPackageManagerInstallCommand(pm);

  if (isDev) {
    installCommand = `${installCommand} --save-dev`;
  }

  try {
    await execWithTimeout(`${pm} ${installCommand} ${dependency}${versionTag}`, timeout);
  } catch (err) {
    console.log('err', err);
    if (versionTag === '@latest') {
      throw err;
    }

    await execWithTimeout(`${pm} ${installCommand} ${dependency}@latest`, timeout);
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
  p.intro(color.inverse('Mastra Create'));

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
  s.start('Creating project');
  try {
    await fs.mkdir(projectName);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      s.stop(
        `A directory named "${projectName}" already exists. Please choose a different name or delete the existing directory.`,
      );
      process.exit(1);
    }
    throw error;
  }

  process.chdir(projectName);
  const pm = getPackageManager();
  const installCommand = getPackageManagerInstallCommand(pm);

  s.message('Creating project');
  // use npm not ${pm} because this just creates a package.json - compatible with all PMs, each PM has a slightly different init command, ex pnpm does not have a -y flag. Use npm here for simplicity
  await exec(`npm init -y`);
  await exec(`npm pkg set type="module"`);
  const depsService = new DepsService();
  await depsService.addScriptsToPackageJson({
    dev: 'mastra dev',
    build: 'mastra build',
  });

  s.stop('Project created');

  s.start(`Installing ${pm} dependencies`);
  await exec(`${pm} ${installCommand} zod`);
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

  s.stop(`${pm} dependencies installed`);
  s.start('Installing mastra');
  const versionTag = createVersionTag ? `@${createVersionTag}` : '@latest';
  await installMastraDependency(pm, 'mastra', versionTag, true, timeout);
  s.stop('mastra installed');

  s.start('Installing @mastra/core');
  await installMastraDependency(pm, '@mastra/core', versionTag, false, timeout);
  s.stop('@mastra/core installed');

  s.start('Adding .gitignore');
  await exec(`echo output.txt >> .gitignore`);
  await exec(`echo node_modules >> .gitignore`);
  await exec(`echo dist >> .gitignore`);
  await exec(`echo .mastra >> .gitignore`);
  await exec(`echo .env.development >> .gitignore`);
  await exec(`echo .env >> .gitignore`);
  await exec(`echo *.db >> .gitignore`);
  await exec(`echo *.db-* >> .gitignore`);
  s.stop('.gitignore added');

  p.outro('Project created successfully');
  console.log('');

  return { projectName };
};

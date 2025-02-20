import * as p from '@clack/prompts';
import child_process from 'node:child_process';
import util from 'node:util';
import color from 'picocolors';

import fs from 'fs/promises';

import { DepsService } from '../../services/service.deps.js';

const exec = util.promisify(child_process.exec);

const execWithTimeout = async (command: string, timeoutMs = 180000) => {
  try {
    const promise = exec(command, { killSignal: 'SIGTERM' });
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
        const match = command.match(/(?:npm|pnpm) i(?:nstall)?\s+(?:-[^\s]+\s+)?(@?[^@\s]+)(?:@[^\s]+)?/);
        if (match) {
          const pkgName = match[1];
          try {
            await fs.access(`node_modules/${pkgName}`);
            return { stdout: '', stderr: '' };
          } catch {
            throw error;
          }
        }
      }
      throw error;
    }
  } catch (error: unknown) {
    throw error;
  }
};

export const createMastraProject = async () => {
  p.intro(color.inverse('Mastra Create'));

  const projectName = await p.text({
    message: 'What do you want to name your project?',
    placeholder: 'my-mastra-app',
    defaultValue: 'my-mastra-app',
  });

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

  s.message('Creating project');
  await exec(`npm init -y`);
  await exec(`npm pkg set type="module"`);
  const depsService = new DepsService();
  await depsService.addScriptsToPackageJson({
    dev: 'mastra dev',
  });

  s.stop('Project created');

  s.start('Installing npm dependencies');
  await exec(`npm i zod`);
  await exec(`npm i typescript tsx @types/node --save-dev`);
  await exec(`echo '{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    ".mastra"
  ]
}' > tsconfig.json`);

  s.stop('NPM dependencies installed');
  s.start('Installing mastra');
  await execWithTimeout(`npm i -D mastra@latest`);
  s.stop('mastra installed');

  s.start('Installing @mastra/core');
  await execWithTimeout(`npm i @mastra/core@latest`);
  s.stop('@mastra/core installed');

  s.start('Adding .gitignore');
  await exec(`echo output.txt >> .gitignore`);
  await exec(`echo node_modules >> .gitignore`);
  await exec(`echo dist >> .gitignore`);
  await exec(`echo .mastra >> .gitignore`);
  await exec(`echo .env.development >> .gitignore`);
  await exec(`echo .env >> .gitignore`);
  await exec(`echo *.db >> .gitignore`);
  s.stop('.gitignore added');

  p.outro('Project created successfully');
  console.log('');

  return { projectName };
};

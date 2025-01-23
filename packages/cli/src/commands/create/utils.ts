import * as p from '@clack/prompts';
import child_process from 'node:child_process';
import util from 'node:util';
import color from 'picocolors';

import fs from 'fs/promises';

import { DepsService } from '../../services/service.deps.js';
import { logger } from '../../utils/logger.js';

const exec = util.promisify(child_process.exec);

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
  const depsService = new DepsService();
  await depsService.addScriptsToPackageJson({
    dev: 'mastra dev',
  });

  s.stop('Project created');

  s.start('Installing npm dependencies');
  await exec(`npm i zod`);
  await exec(`npm i typescript tsx @types/node --save-dev`);
  s.stop('NPM dependencies installed');
  s.start('Installing mastra');
  await exec(`npm i -D mastra`);
  s.stop('mastra installed');

  s.start('Installing @mastra/core');
  await exec(`npm i @mastra/core@alpha`);
  s.stop('@mastra/core installed');

  s.start('Adding .gitignore');
  await exec(`echo output.txt >> .gitignore`);
  await exec(`echo node_modules >> .gitignore`);
  await exec(`echo dist >> .gitignore`);
  await exec(`echo .mastra >> .gitignore`);
  s.stop('.gitignore added');

  p.outro('Project created successfully');
  logger.break();

  return { projectName };
};

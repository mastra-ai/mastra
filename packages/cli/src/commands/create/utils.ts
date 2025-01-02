import * as p from '@clack/prompts';
import child_process from 'node:child_process';
import util from 'node:util';

import fs from 'fs/promises';

import { logger } from '../../utils/logger.js';

const exec = util.promisify(child_process.exec);

export const createMastraProject = async () => {
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

  await fs.mkdir(projectName);
  process.chdir(projectName);

  await exec(`npm init -y`);
  await exec(`npm i zod typescript tsx @types/node --save-dev`);

  s.message('Installing dependencies');

  await exec(`echo output.txt >> .gitignore`);
  await exec(`echo node_modules >> .gitignore`);

  await exec(`npm i @mastra/core@alpha`);
  s.stop('Project creation successful');
  logger.break();

  return { projectName };
};

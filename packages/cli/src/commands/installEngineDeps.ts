import chalk from 'chalk';
import { execa } from 'execa';
import inquirer from 'inquirer';
import yoctoSpinner from 'yocto-spinner';

import { copyStarterFile } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

const spinner = yoctoSpinner({ text: 'Install engine deps\n' });
export async function installEngineDeps() {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.bold.yellow('Do you want to install the dependencies?'),
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.redBright('Installation Cancelled'));
      return;
    }

    spinner.start();
    await installPackages();
    spinner.success('Dependencies installed successfully');
  } catch (err) {
    spinner.error('Could not install dependencies');
    console.error(err);
  }
}

async function installPackages() {
  const packageManager = getPackageManager();
  //pnpm add, npm i, yarn add
  let runCommand = packageManager;
  if (packageManager === 'npm') {
    runCommand = `${packageManager} i`;
  } else {
    runCommand = `${packageManager} add`;
  }

  return execa(`${runCommand} @mastra/engine@alpha drizzle-kit`, {
    all: true,
    shell: true,
    stdio: 'inherit',
  });
}

async function CopyDockerComposeFile() {
  copyStarterFile('mastra-pg.docker-compose.yaml', 'mastra-pg.docker-compose,yaml');
}

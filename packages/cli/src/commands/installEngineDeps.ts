import * as p from '@clack/prompts';
import { execa } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import getPackageManager from '../utils/getPackageManager.js';

const spinner = yoctoSpinner({ text: 'Install engine deps\n' });
export async function installEngineDeps() {
  try {
    const confirm = await p.confirm({
      message: 'Do you want to install dependencies?',
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel('Installation Canelled');
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

  let runCommand = packageManager;
  if (packageManager === 'npm') {
    runCommand = `${packageManager} i`;
  } else {
    runCommand = `${packageManager} add`;
  }

  return execa(`${runCommand} @mastra/engine@alpha`, {
    all: true,
    shell: true,
    stdio: 'inherit',
  });
}

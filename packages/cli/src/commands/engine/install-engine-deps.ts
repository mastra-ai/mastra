import * as p from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps.js';

const spinner = yoctoSpinner({ text: 'Install engine deps\n' });
export async function installEngineDeps() {
  try {
    const confirm = await p.confirm({
      message: 'Do you want to install dependencies?',
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel('Installation Cancelled');
      return;
    }

    const depsService = new DepsService();
    spinner.start();
    await depsService.installPackages(['@mastra/engine@alpha', 'drizzle-kit']);
    spinner.success('Dependencies installed successfully');
  } catch (err) {
    spinner.error('Could not install dependencies');
    console.error(err);
  }
}

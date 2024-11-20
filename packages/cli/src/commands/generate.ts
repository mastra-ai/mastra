import { execa } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getEnginePath } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

const spinner = yoctoSpinner({ text: 'Generating drizzle client' });
export async function generate(dbUrl: string) {
  try {
    spinner.start();
    await generateDrizzleClient(dbUrl);
    spinner.success('Drizzle client generated');
  } catch (err) {
    spinner.error('Could not generate drizzle client');
    console.error(err);
  }
}
async function generateDrizzleClient(dbUrl: string) {
  const enginePath = getEnginePath();

  const packageManager = getPackageManager();

  let runCommand = packageManager;

  if (packageManager === 'npm') {
    runCommand = `${packageManager} run`;
  }

  return execa(`cd ${enginePath} && ${runCommand} generate-pg`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: 'inherit', // inherit will pipe directly to parent process stdout/stderr
  });
}

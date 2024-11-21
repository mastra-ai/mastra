import { execa, ExecaError } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getEnginePath } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

const spinner = yoctoSpinner({ text: 'Generating drizzle client\n' });
export async function generate(dbUrl: string) {
  try {
    spinner.start();
    await generateDrizzleClient(dbUrl);
    spinner.success('Drizzle client generate\n');
  } catch (err) {
    spinner.error('Could not generate drizzle client\n');
    console.error(err);
  }
}
async function generateDrizzleClient(dbUrl: string) {
  const enginePath = getEnginePath();

  const packageManager = getPackageManager();

  const args = packageManager === 'npm' ? ['run', 'generate-pg'] : ['generate-pg'];

  try {
    await execa(packageManager, args, {
      env: {
        ...process.env,
        DB_URL: dbUrl,
      },
      cwd: enginePath,
      shell: true,
      all: true,
    });
  } catch (error: unknown) {
    throw error;
  }
}

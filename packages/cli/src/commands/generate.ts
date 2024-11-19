import { execa } from 'execa';

import { getEnginePath } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

export async function generate(dbUrl: string) {
  await generateDrizzleClient(dbUrl);
}

async function generateDrizzleClient(dbUrl: string) {
  console.log('Generating Drizzle client...');

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

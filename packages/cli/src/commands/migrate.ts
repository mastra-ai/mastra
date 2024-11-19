import { execa, ExecaError } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getEnginePath } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

const spinner = yoctoSpinner({ text: 'Migrating Database\n' });

export async function migrate(createOnly = false, dbUrl: string) {
  spinner.start();
  try {
    await checkPostgresReady(dbUrl);
    await _migrate(createOnly, dbUrl);

    spinner.success('Congrats! Your project is ready to go.');
    return true;
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.log(error);
    }
    spinner.error('Could not migrate database');
    console.log(`Error: ${error.message}`, true);
    if (error.stderr) {
      console.log(`stderr: ${error.stderr}`, true);
    }
  }
  return false;
}

interface MigrationResult {
  stdout: string;
  stderr: string;
}

export async function _migrate(createOnly = false, dbUrl: string, swallow: boolean = false): Promise<MigrationResult> {
  const enginePath = getEnginePath();
  const packageManager = getPackageManager();

  let runCommand = packageManager;

  if (packageManager === 'npm') {
    runCommand = `${runCommand} run`;
  }

  const stdioMode = swallow ? 'pipe' : 'inherit';

  const subprocess = execa(`cd ${enginePath} && ${runCommand} migrate-pg`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: ['pipe', stdioMode, stdioMode],
    timeout: 60000,
  });

  if (subprocess.stdin) {
    subprocess.on('spawn', () => {
      const responses = ['y\n', 'yes\n'];
      const respondToPrompts = setInterval(() => {
        if (subprocess.stdin && !subprocess.stdin.destroyed) {
          responses.forEach(response => {
            subprocess.stdin.write(response);
          });
        }
      }, 100);

      subprocess.on('exit', () => {
        clearInterval(respondToPrompts);
        subprocess.stdin?.end();
      });
    });
  }

  try {
    const { stdout, stderr } = await subprocess;
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (error: any) {
    if (error.killed && error.timedOut) {
      throw new Error(`Command timed out after 60000ms`);
    }
    throw error;
  }
}

async function checkPostgresReady(dbUrl: string) {
  for (let i = 0; i < 10; i++) {
    try {
      await _migrate(true, dbUrl, true); // attempts to create the migration w/o applying it
      return true;
    } catch (error) {
      console.log(error);
      console.log(`Waiting for postgres to be ready, attempt ${i + 1} of 10`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres is not ready, aborting');
}

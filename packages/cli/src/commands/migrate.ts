import { execa, ExecaError } from 'execa';

import { getPrismaBinPath, getPrismaFilePath } from '../utils.js';

export async function migrate(createOnly = false, dbUrl: string) {
  console.log('Migrating database...');
  try {
    await checkPostgresReady(dbUrl);
    await _migrate(createOnly, dbUrl);

    console.log('Congrats! Your project is ready to go.');
    return true;
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.log(error);
    }
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
  const PRISMA_BIN = getPrismaBinPath();
  const PRISMA_SCHEMA = getPrismaFilePath('schema.prisma');
  const CREATE_ONLY = createOnly ? `--create-only` : ``;

  const command = `${PRISMA_BIN} migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`;

  const stdioMode = swallow ? 'pipe' : 'inherit';

  const subprocess = execa(command, {
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
      throw new Error(`Command timed out after 30000ms: ${command}`);
    }
    throw error;
  }
}
async function checkPostgresReady(dbUrl: string) {
  console.log('Checking if postgres is ready...');
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

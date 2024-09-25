import { execa, ExecaError } from 'execa';

import { getPrismaBinPath, getPrismaSchemaPath } from '../utils.js';

export async function migrate(createOnly = false, dbUrl: string) {
  console.log('Migrating database...');
  try {
    await checkPostgresReady(dbUrl);
    await _migrate(createOnly, dbUrl);

    console.log('Congrats! Your project is ready to go.');
    return true;
  } catch (error: any) {
    console.log(error, '####')
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

export async function _migrate(createOnly = false, dbUrl: string, swallow: boolean = false) {
  const PRISMA_BIN = getPrismaBinPath();

  const PRISMA_SCHEMA = getPrismaSchemaPath();

  const CREATE_ONLY = createOnly ? `--create-only` : ``;

  return execa(`${PRISMA_BIN} migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: swallow ? 'ignore' : 'inherit', // inherit will pipe directly to parent process stdout/stderr
  });
}

async function checkPostgresReady(dbUrl: string) {
  for (let i = 0; i < 10; i++) {
    try {
      await _migrate(true, dbUrl, true); // attempts to create the migration w/o applying it
      return true;
    } catch (error) {
      console.error(error);
      console.log(`Waiting for postgres to be ready, attempt ${i + 1} of 10`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres is not ready, aborting');
}

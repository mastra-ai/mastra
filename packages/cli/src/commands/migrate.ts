import { execa, ExecaError } from 'execa';
import path from 'path';

async function checkPostgresReady(dbUrl: string) {
  for (let i = 0; i < 10; i++) {
    try {
      await _migrate(true, dbUrl, true); // attempts to create the migration w/o applying it
      return true;
    } catch (error) {
      console.log(`Waiting for postgres to be ready, attempt ${i + 1} of 10`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres is not ready, aborting');
}

async function _migrate(createOnly = false, dbUrl: string, swallow: boolean = false) {
  const PRISMA_BIN = path.resolve(
    process.cwd(),
    'node_modules',
    '@arkw/core',
    'node_modules',
    'prisma',
    'node_modules',
    '.bin',
  );

  const PRISMA_SCHEMA = path.resolve(process.cwd(), 'node_modules', '@arkw/core', 'src', 'prisma', 'schema.prisma');

  const CREATE_ONLY = createOnly ? `--create-only` : ``;

  return execa(`${PRISMA_BIN}/prisma migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: swallow ? 'ignore' : 'inherit', // inherit will pipe directly to parent process stdout/stderr
  });
}

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

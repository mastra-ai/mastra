import { intro, note, spinner } from '@clack/prompts';
import { execa, ExecaError } from 'execa';
import path from 'path';
import color from 'picocolors';

import { getEnginePath } from '../../utils/get-engine-path';

const s = spinner();

export async function migrate(dbUrl: string) {
  intro(`${color.bgCyan(color.black(' Mastra migrate '))}`);
  s.start('Migrating Database\n');
  try {
    await checkPostgresReady(dbUrl);
    s.stop();
    note('Migration complete! Your project is ready to go.');
    process.exit(0);
  } catch (error: any) {
    s.stop('Could not migrate database');
    if (error instanceof ExecaError) {
      console.error('error');
    } else {
      console.log(`Error: ${error.message}`);
    }

    process.exit(1);
  }
}

interface MigrationResult {
  stdout: string;
  stderr: string;
}

export async function _migrate(dbUrl: string, swallow: boolean = false): Promise<MigrationResult> {
  const enginePath = getEnginePath();

  const stdioMode = swallow ? 'pipe' : 'inherit';

  const newPath = path.join(enginePath, 'dist', 'postgres', 'migrate.js');

  const subprocess = execa(`node`, [`${newPath}`], {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    shell: true,
    all: true,
    stdio: ['pipe', stdioMode, stdioMode],
    timeout: 60000,
  });

  subprocess.stdout?.pipe(process.stdout);

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
      await _migrate(dbUrl); // attempts to create the migration w/o applying it
      return true;
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }

      console.log(`Waiting for postgres to be ready, attempt ${i + 1} of 10`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres is not ready, aborting');
}

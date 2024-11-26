import chalk from 'chalk';
import { execa } from 'execa';
import path from 'path';
import yoctoSpinner from 'yocto-spinner';

import { getCliPath } from '../utils.js';

const spinner = yoctoSpinner({ text: 'Generating drizzle client\n' });

export async function generate(dbUrl: string) {
  try {
    spinner.start();
    const res = await generateDrizzleClient(dbUrl);
    if (res) {
      spinner.success('Drizzle client generated\n');
    } else {
      spinner.stop(`Schema already generated,\nrun ${chalk.blue.bold('migrate')}`);
    }
  } catch (err) {
    spinner.error('Could not generate drizzle client\n');
    console.error(err);
  }
}
async function generateDrizzleClient(dbUrl: string) {
  const cliPath = getCliPath();

  if (!cliPath) {
    return false;
  }
  const schemaPath = path.join(cliPath, 'dist/postgres/db/schema.js');
  const outputPath = path.join(cliPath, 'dist/postgres/drizzle');

  try {
    await execa(
      'npx',
      ['drizzle-kit', 'generate', `--out=${outputPath}`, '--dialect=postgresql', `--schema=${schemaPath}`],
      {
        env: {
          ...process.env,
          DB_URL: dbUrl,
        },
        cwd: cliPath,
        stdio: 'inherit',
      },
    );
    return true;
  } catch (err: unknown) {
    throw err;
  }
}

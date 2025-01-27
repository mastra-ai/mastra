import { execa } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { getEnginePath } from '../../utils/get-engine-path';

const spinner = yoctoSpinner({ text: 'Generating drizzle client\n' });

const checkDrizzleInstallation = async () => {
  const depsService = new DepsService();
  if ((await depsService.checkDependencies(['drizzle-kit'])) === 'ok') {
    return true;
  } else {
    return false;
  }
};

const installDrizzleKit = async () => {
  const depsService = new DepsService();
  await depsService.installPackages(['drizzle-kit']);
};

export async function generate(dbUrl: string) {
  try {
    spinner.start();
    const isDrizzleInstalled = await checkDrizzleInstallation();

    if (!isDrizzleInstalled) {
      spinner.text = 'Installing drizzle kit\n';
      await installDrizzleKit();
    }

    await generateDrizzleClient(dbUrl);
    spinner.success('Drizzle client generated\n');
  } catch (err) {
    spinner.error('Could not generate drizzle client\n');
    console.error(err);
  }
}

async function generateDrizzleClient(dbUrl: string) {
  const enginePath = getEnginePath();

  try {
    await execa(
      `npx drizzle-kit generate --out=./dist/postgres/drizzle --dialect=postgresql --schema=./dist/postgres/db/schema.js`,
      {
        env: {
          ...process.env,
          DB_URL: dbUrl,
        },
        cwd: enginePath,
        shell: true,
        all: true,
        stdio: 'inherit', // inherit will pipe directly to parent process stdout/stderr
      },
    );
  } catch (err: unknown) {
    throw err;
  }
}

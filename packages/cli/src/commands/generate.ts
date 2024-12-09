import { execa } from 'execa';
import path from 'path';
import { PackageJson } from 'type-fest';
import yoctoSpinner from 'yocto-spinner';

import fsExtra from 'fs-extra/esm';

import { getEnginePath } from '../utils/get-engine-path.js';
import getPackageManager from '../utils/get-package-manager.js';

const spinner = yoctoSpinner({ text: 'Generating drizzle client\n' });

const checkDrizzleInstallation = async () => {
  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkgJson = (await fsExtra.readJSON(pkgJsonPath)) as PackageJson;
  if (pkgJson.dependencies && !pkgJson.dependencies['drizzle-kit']) {
    return false;
  } else {
    return true;
  }
};

const installDrizzleKit = async () => {
  const packageManager = getPackageManager();

  let runCommand = packageManager;
  if (packageManager === 'npm') {
    runCommand = `${packageManager} i`;
  } else {
    runCommand = `${packageManager} add`;
  }

  await execa(`${runCommand} drizzle-kit`, {
    all: true,
    shell: true,
    stdio: 'inherit',
  });
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

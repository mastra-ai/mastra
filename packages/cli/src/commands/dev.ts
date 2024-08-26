import { execa, ExecaError } from 'execa';
import fs from 'fs';
import path from 'path';
import process from 'process';

import fse from 'fs-extra/esm';

async function copyUserEnvFileToAdmin(adminPath: string) {
  const sourcePath = path.resolve(process.cwd(), '.env');
  const destinationPath = path.resolve(process.cwd(), adminPath, '.env');

  fse.copy(sourcePath, destinationPath, { overwrite: true }, err => {
    if (err) {
      console.log('An error occurred while trying to copy the .env file from ark project directory to admin.');
      console.error(err);
    }
  });
}

async function watchUserEnvAndSyncWithAdminEnv(adminPath: string) {
  const userEnvPath = path.resolve(process.cwd(), '.env');

  try {
    fs.watch(userEnvPath, eventType => {
      if (eventType === 'change') {
        copyUserEnvFileToAdmin(adminPath);
      }
    });
  } catch (err) {
    console.log('An error occurred while trying to watch the .env file in the ark project directory.');
    console.error(err);
  }
}

export async function startNextDevServer() {
  console.log('Starting Next.js dev server...');

  try {
    // TODO: fix cwd so it works from project directory, not just from the cli directory
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const adminPath = path.resolve(__dirname, '..', '..', 'node_modules', '@arkw', 'admin');
    copyUserEnvFileToAdmin(adminPath);
    watchUserEnvAndSyncWithAdminEnv(adminPath);

    const nextServer = execa(`npm run dev -- -p 3456`, {
      cwd: adminPath,
      all: true,
      buffer: false,
      env: {
        ...process.env,
        ARK_APP_DIR: process.cwd(),
      },
      shell: true,
      stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
    });

    process.on('SIGINT', async () => {
      console.log('Stopping Next.js dev server...');
      nextServer.kill();
      process.exit();
    });

    await nextServer;
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.error(error);
    }
    console.error(`Error: ${error.message}`);
  }
}

export function dev() {
  startNextDevServer().catch(console.error);
  return;
}

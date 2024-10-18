import { execa, ExecaError } from 'execa';
import fs, { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import process from 'process';

import fse from 'fs-extra/esm';

import { getFirstExistingFile } from '../utils.js';
import getPackageManager from '../utils/getPackageManager.js';

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

const objectToEnvString = (envObject: Record<string, any>): string => {
  return Object.entries(envObject)
    .map(([key, value]) => {
      // Ensure the value is stringified and handle special characters if needed
      const stringValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${key}="${stringValue}"`;
    })
    .join('\n');
};

async function copyEnvToAdmin(adminPath: string) {
  const destinationPath = path.resolve(process.cwd(), adminPath, '.env');

  console.log(objectToEnvString(process.env), 'process.env');

  fs.writeFileSync(destinationPath, objectToEnvString(process.env), 'utf-8');
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

async function generateUserDefinedIntegrations({
  adminPath,
  integrationsPath,
}: {
  adminPath: string;
  integrationsPath: string;
}) {
  const buildUserDefinedIntegrationScript = path.resolve(adminPath, 'scripts', 'build-user-defined-integrations.mjs');

  await execa(`node`, [buildUserDefinedIntegrationScript], {
    cwd: adminPath,
    env: {
      ...process.env,
      INTEGRATION_PATH: integrationsPath,
    },
  });
}

const copyFolder = async (src: string, dest: string): Promise<void> => {
  // Resolve the paths to ensure they are absolute
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);

  try {
    // Use the `cp` command with the `-r` flag for recursive copying
    await execa('cp', ['-r', resolvedSrc, resolvedDest]);
    console.log(`Folder copied from ${resolvedSrc} to ${resolvedDest}`);
  } catch (error: any) {
    console.error(`Error copying folder: ${error.message}`);
  }
};

export async function startNextDevServer() {

  // 1. Make a tmp dir
  const tmpDir = path.resolve(os.tmpdir(), '@mastra-admin');

  try {
    // TODO: fix cwd so it works from project directory, not just from the cli directory
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);

    const possibleAdminPaths = [
      path.resolve(__dirname, '..', '..', '..', 'node_modules', '@mastra', 'admin', 'next.config.mjs'),
      path.resolve(__dirname, '..', '..', 'node_modules', '@mastra', 'admin', 'next.config.mjs'),
    ];

    // Determine the admin path.
    let adminPath = getFirstExistingFile(possibleAdminPaths);

    // Remove the next.config.js file from the admin path
    adminPath = path.resolve(adminPath, '..');

    await copyFolder(adminPath, tmpDir);

    adminPath = path.resolve(tmpDir, 'admin');

    copyUserEnvFileToAdmin(adminPath);

    watchUserEnvAndSyncWithAdminEnv(adminPath);

    const integrationsPath = path.resolve(process.cwd(), 'integrations');

    if (fs.existsSync(integrationsPath)) {
      generateUserDefinedIntegrations({ adminPath, integrationsPath });
    }

    console.log('Installing Admin deps...');

    const packageManager = getPackageManager()

    await execa(`${packageManager} i`, {
      cwd: adminPath,
      all: true,
      buffer: false,
      env: {
        ...process.env,
        ARK_APP_DIR: process.cwd(),
      },
      shell: true,
      stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
    })

    // Move prisma client to root node_modules
    const corePrismaPath = path.resolve(adminPath, 'node_modules', '@mastra', 'core', 'node_modules', '@prisma-app');
    const rootPrismaPath = path.resolve(adminPath, 'node_modules', '@prisma-app');
    await copyFolder(corePrismaPath, rootPrismaPath);

    console.log('Starting Next.js dev server...');

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

export async function buildNextDevServer() {
  console.log('Starting Next.js dev server...');

  try {
    // TODO: fix cwd so it works from project directory, not just from the cli directory
    const __filename = new URL(import.meta.url).pathname;

    console.log('filename', __filename);

    const __dirname = path.dirname(__filename);

    console.log('dirname', __dirname);

    const adminPath = path.resolve(__dirname, '..', '..', '..', '@mastra', 'admin');

    console.log('adminPath', adminPath);

    copyEnvToAdmin(adminPath);

    const integrationsPath = path.resolve(process.cwd(), 'integrations');

    if (fs.existsSync(integrationsPath)) {
      generateUserDefinedIntegrations({ adminPath, integrationsPath });
    }

    await execa(`npm run build`, {
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

    await copyFolder(path.resolve(adminPath, '.next'), path.resolve(process.cwd(), '.next'));

    process.exit();
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.error(error);
    }
    console.error(`Error: ${error.message}`);
  }
}

export function build() {
  buildNextDevServer().catch(console.error);
  return;
}

export function dev({ integration }: { integration: boolean }) {
  if (integration) {
    console.log('Generating Admin for integration development...');
    const configPath = path.join(process.cwd(), 'mastra.config.ts');
    const dirName = path.basename(process.cwd());
    const capitalized = dirName.charAt(0).toUpperCase() + dirName.slice(1);

    const envPath = path.join(process.cwd(), '.env');

    if (!existsSync(envPath)) {
      fs.writeFileSync(envPath, '');
    }

    fs.writeFileSync(
      configPath,
      `
    import { Config } from '@mastra/core';
    import { ${capitalized}Integration } from './src';

    export const config: Config = {
      name: '${capitalized.toUpperCase()}',
      db: {
        provider: 'postgresql',
        uri: process.env.DATABASE_URL!,
      },
      workflows: {
        blueprintDirPath: '/mock-data/blueprints',
        systemApis: [],
        systemEvents: {},
      },
      routeRegistrationPath: '/api/mastra',
      systemHostURL: process.env.APP_URL!,
      integrations: [
        new ${capitalized}Integration({
           config: {
              CLIENT_ID: process.env.CLIENT_ID!,
              CLIENT_SECRET: process.env.CLIENT_SECRET!,
              REDIRECT_URI: '/api/mastra/callback',
           }
        })
      ]
    }
    `,
    );
  }

  startNextDevServer().catch(console.error);
  return;
}

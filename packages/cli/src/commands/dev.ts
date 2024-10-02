import { execa, ExecaError } from 'execa';
import fs, { existsSync } from 'fs';
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

export async function startNextDevServer() {
  console.log('Starting Next.js dev server...');

  try {
    // TODO: fix cwd so it works from project directory, not just from the cli directory
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const adminPath = path.resolve(__dirname, '..', '..', 'node_modules', '@mastra', 'admin');
    copyUserEnvFileToAdmin(adminPath);
    watchUserEnvAndSyncWithAdminEnv(adminPath);

    const integrationsPath = path.resolve(process.cwd(), 'integrations');
    if (fs.existsSync(integrationsPath)) {
      generateUserDefinedIntegrations({ adminPath, integrationsPath });
    }

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

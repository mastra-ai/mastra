import { execa } from 'execa';
import path from 'path';
import prompt from 'prompt';

import fs from 'fs';
import fse from 'fs-extra/esm';

import { config as defaultConfig } from '../starter-files/config.js';
import { FileEnvService } from '../services/service.fileEnv.js';
import { replaceValuesInFile, copyStarterFile, sanitizeForDockerName, getInfraPorts } from '../utils.js';

const DOCKER_COMPOSE_FILE = 'arkw.docker-compose.yaml';
const ARKW_CONFIG_FILE = 'arkw.config.ts';

export async function provision(projectName: string) {
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort, inngestPort } = await getInfraPorts();

  await setupConfig({ postgresPort, sanitizedProjectName });
  await setupRoutes();

  const { userInputDbUrl, userInputInngestUrl } = await promptUserForInfra();

  const shouldRunDocker = userInputDbUrl === '';

  const { dbUrl, inngestUrl } = prepareDockerComposeFile({
    userInputDbUrl: String(userInputDbUrl),
    userInputInngestUrl: String(userInputInngestUrl),
    sanitizedProjectName,
    postgresPort,
    inngestPort,
  });

  if (shouldRunDocker) {
    try {
      await execa(
        'docker', 
        ['compose', '-f', DOCKER_COMPOSE_FILE, 'up', '-d'], 
        { stdio: 'inherit' }
      );
      console.log('Docker containers started successfully.');
    } catch (error) {
      console.error('Failed to start Docker containers:', error);
      throw error;
    }
  }

  return { dbUrl, inngestUrl };
}

export function prepareDockerComposeFile({
  userInputDbUrl,
  userInputInngestUrl,
  sanitizedProjectName,
  postgresPort,
  inngestPort,
}: {
  userInputDbUrl: string;
  userInputInngestUrl: string;
  sanitizedProjectName: string;
  postgresPort: number;
  inngestPort: number;
}) {
  let inngestUrl = `http://localhost:${inngestPort}`;
  let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/arkwright?schema=arkw`;

  const editDockerComposeFile = () => {
    replaceValuesInFile({
      filePath: DOCKER_COMPOSE_FILE,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
        { replace: `${inngestPort}`, search: 'REPLACE_INNGEST_PORT' },
      ],
    });
  };

  if (userInputDbUrl === '' && userInputInngestUrl === '') {
    copyStarterFile('docker-compose-pg-inngest.yaml', DOCKER_COMPOSE_FILE);
    editDockerComposeFile();
  } else if (userInputDbUrl === '' && userInputInngestUrl !== '') {
    copyStarterFile('docker-compose-pg-only.yaml', DOCKER_COMPOSE_FILE);
    editDockerComposeFile();
    inngestUrl = String(userInputInngestUrl);
  } else if (userInputDbUrl !== '' && userInputInngestUrl === '') {
    throw new Error('Remote Inngest cannot reach local database');
  } else {
    inngestUrl = String(userInputInngestUrl);
    dbUrl = String(userInputDbUrl);
  }

  return { dbUrl, inngestUrl };
}

export async function setupRoutes() {
  const { routeRegistrationPath } = defaultConfig;
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  const arkwConfigAlias = '@arkw/config';

  if (!(arkwConfigAlias in tsconfig.compilerOptions.paths)) {
    tsconfig.compilerOptions.paths[arkwConfigAlias] = ['arkw.config.ts'];
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
  }

  const apiPath = path.join(`src/app`, routeRegistrationPath, '[...arkw]/route.ts');

  if (fs.existsSync(apiPath)) {
    console.log('Routes file already exists');
    return;
  }

  copyStarterFile('api.ts', apiPath);
}

async function promptUserForInfra() {
  prompt.start();
  const { userInputDbUrl, userInputInngestUrl } = await prompt.get({
    properties: {
      userInputDbUrl: {
        description:
          'Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(postgresql:\/\/.*|)$/,
        message: 'Please enter a valid PostgreSQL connection string or leave blank',
        required: false,
      },
      userInputInngestUrl: {
        description: 'Enter your Inngest server URL or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(https?:\/\/.*|)$/,
        message: 'Please enter a valid URL or leave blank',
        required: false,
      },
    },
  });

  return { userInputDbUrl, userInputInngestUrl };
}

async function setupConfig({
  postgresPort,
  sanitizedProjectName,
}: {
  postgresPort: number;
  sanitizedProjectName: string;
}) {
  copyStarterFile('config.ts', ARKW_CONFIG_FILE);

  replaceValuesInFile({
    filePath: ARKW_CONFIG_FILE,
    replacements: [
      {
        search: 'REPLACE_DB_PORT',
        replace: `${postgresPort}`,
      },
      {
        search: 'PROJECT_NAME',
        replace: `${sanitizedProjectName}`,
      },
    ],
  });
}

export async function setupEnvFile({ inngestUrl, dbUrl }: { inngestUrl: string; dbUrl: string }) {
  const envPath = path.join(process.cwd(), '.env');

  await fse.ensureFile(envPath);

  const fileEnvService = new FileEnvService(envPath);
  await fileEnvService.setEnvValue('INNGEST_URL', inngestUrl);
  await fileEnvService.setEnvValue('DB_URL', dbUrl);
  await fileEnvService.setEnvValue('APP_URL', 'http://localhost:3000');
}
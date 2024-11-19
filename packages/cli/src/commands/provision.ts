import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import prompt from 'prompt';

import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';
import { config as defaultConfig } from '../starter-files/config.js';
import { replaceValuesInFile, copyStarterFile, sanitizeForDockerName, getInfraPorts } from '../utils.js';

const DOCKER_COMPOSE_FILE = 'mastra.docker-compose.yaml';
const KPL_CONFIG_FILE = 'mastra.config.ts';

export async function provision(projectName: string) {
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort, adminPort } = await getInfraPorts();

  const { userInputDbUrl } = await promptUserForInfra();

  const shouldRunDocker = userInputDbUrl === '';

  if (shouldRunDocker) {
    try {
      console.log('Checking if Docker is running...');
      await execa('docker', ['info'], { stdio: 'ignore', shell: true });
    } catch (error) {
      console.error('Docker is not running. Please start Docker and try again.');
      throw error;
    }
  }

  const { dbUrl } = prepareDockerComposeFile({
    userInputDbUrl: String(userInputDbUrl),
    sanitizedProjectName,
    postgresPort,
  });

  if (shouldRunDocker) {
    try {
      await execa('docker', ['compose', '-f', DOCKER_COMPOSE_FILE, 'up', '-d'], { stdio: 'inherit' });
      console.log('Docker containers started successfully.');
    } catch (error) {
      console.error('Failed to start Docker containers:', error);
      throw error;
    }
  }

  await setupConfig({ postgresPort, sanitizedProjectName });
  await setupRoutes();

  return { dbUrl, adminPort };
}

export function prepareDockerComposeFile({
  userInputDbUrl,
  sanitizedProjectName,
  postgresPort,
}: {
  userInputDbUrl: string;
  sanitizedProjectName: string;
  postgresPort: number;
}) {
  let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/mastra?schema=mastra`;

  const editDockerComposeFileForPG = () => {
    replaceValuesInFile({
      filePath: DOCKER_COMPOSE_FILE,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
      ],
    });
  };

  if (userInputDbUrl === '') {
    copyStarterFile('docker-compose-pg-inngest.yaml', DOCKER_COMPOSE_FILE);
    editDockerComposeFileForPG();
  } else if (userInputDbUrl === '') {
    copyStarterFile('docker-compose-pg-only.yaml', DOCKER_COMPOSE_FILE);
    editDockerComposeFileForPG();
  } else if (userInputDbUrl !== '') {
    copyStarterFile('docker-compose-inngest-only.yaml', DOCKER_COMPOSE_FILE);
    dbUrl = String(userInputDbUrl);
  } else {
    dbUrl = String(userInputDbUrl);
  }

  return { dbUrl };
}

export async function setupRoutes() {
  const { routeRegistrationPath } = defaultConfig;
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  const mastraConfigAlias = '@mastra/config';

  if (!tsconfig.compilerOptions) {
    tsconfig.compilerOptions = {};
  }

  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }

  if (!(mastraConfigAlias in tsconfig.compilerOptions.paths)) {
    tsconfig.compilerOptions.paths[mastraConfigAlias] = [KPL_CONFIG_FILE];
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
  }

  const apiPath = path.join(`src/app`, routeRegistrationPath, '[...mastra]/route.ts');

  if (fs.existsSync(apiPath)) {
    console.log('Routes file already exists');
    return;
  }

  copyStarterFile('api.ts', apiPath);
}

async function promptUserForInfra() {
  prompt.start();
  const { userInputDbUrl } = await prompt.get({
    properties: {
      userInputDbUrl: {
        description:
          'Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(postgresql:\/\/.*|)$/,
        message: 'Please enter a valid PostgreSQL connection string or leave blank',
        required: false,
      },
    },
  });

  return { userInputDbUrl };
}

async function setupConfig({
  postgresPort,
  sanitizedProjectName,
}: {
  postgresPort: number;
  sanitizedProjectName: string;
}) {
  copyStarterFile('config.ts', KPL_CONFIG_FILE);

  replaceValuesInFile({
    filePath: KPL_CONFIG_FILE,
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

export async function setupEnvFile({ dbUrl, adminPort }: { dbUrl: string; adminPort: number }) {
  const envPath = path.join(process.cwd(), '.env.development');

  await fse.ensureFile(envPath);

  const fileEnvService = new FileEnvService(envPath);
  await fileEnvService.setEnvValue('DB_URL', dbUrl);
  await fileEnvService.setEnvValue('APP_URL', 'http://localhost:3000');
  await fileEnvService.setEnvValue('MASTRA_ADMIN_PORT', `${adminPort}`);
}

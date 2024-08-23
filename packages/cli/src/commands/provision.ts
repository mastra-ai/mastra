import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import prompt from 'prompt';
import { check } from 'tcp-port-used';

import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';
import { replaceValuesInFile } from '../utils.js';

const DOCKER_COMPOSE_FILENAME = 'arkw.docker-compose.yaml';

export async function provision(projectName: string) {
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort, inngestPort } = await getInfraPorts();

  await setupConfigFile({ postgresPort, sanitizedProjectName });

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
    console.log('Starting Docker containers...');
    try {
      await execa('docker', ['compose', '-f', DOCKER_COMPOSE_FILENAME, 'up', '-d'], { stdio: 'inherit' });
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
  let inngestUrl: string;
  let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/arkwright?schema=arkw`;

  const editDockerComposeFile = () => {
    replaceValuesInFile({
      filePath: DOCKER_COMPOSE_FILENAME,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
        { replace: `${inngestPort}`, search: 'REPLACE_INNGEST_PORT' },
      ],
    });
  }

  if (userInputDbUrl === '' && userInputInngestUrl === '') {
    console.log('Creating new PostgreSQL instance and Inngest server...');
    copyStarterFile('starter-docker-compose.yaml', DOCKER_COMPOSE_FILENAME);
    editDockerComposeFile();
    inngestUrl = `http://localhost:${inngestPort}`;
  } else if (userInputDbUrl === '' && userInputInngestUrl !== '') {
    console.log('Setting up new Inngest server...');
    copyStarterFile('starter-docker-compose-postgres.yaml', DOCKER_COMPOSE_FILENAME);
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

export function copyStarterFile(inputFile: string, outputFile: string) {
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '..', '..', 'src', 'files', inputFile);
  const fileString = fs.readFileSync(filePath, 'utf8');

  const outputFilePath = path.join(process.cwd(), outputFile);
  if (fs.existsSync(outputFilePath)) {
    console.log(`${outputFile} already exists`);
    return false;
  }

  fse.outputFileSync(outputFilePath, fileString);
  return fileString;
}

export async function setupRoutesFile(configContents: string) {
  const regex = /routeRegistrationPath:\s*'([^']+)'/;
  const match = configContents.match(regex);

  if (!match) return;

  const apiPath = path.join(`src/app`, match[1], '[...arkw]/route.ts');

  if (fs.existsSync(apiPath)) {
    console.log('Routes file already exists');
    return;
  }

  copyStarterFile('starter-api.ts', apiPath);
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

async function setupConfigFile({
  postgresPort,
  sanitizedProjectName,
}: {
  postgresPort: number;
  sanitizedProjectName: string;
}) {
  copyStarterFile('starter-config.ts', 'arkw.config.ts');

  replaceValuesInFile({
    filePath: 'arkw.config.ts',
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

const isPortOpen = async (port: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    check(port).then((inUse: boolean) => {
      resolve(!inUse);
    });
  });
};

const getNextOpenPort = async (startFrom: number = 2222): Promise<number> => {
  for (const port of Array.from({ length: 20 }, (_, i) => startFrom + i)) {
    const isOpen = await isPortOpen(port);
    if (isOpen) {
      return port;
    }
  }
  throw new Error('No open ports found after 20 attempts');
};

async function getInfraPorts() {
  let postgresPort = 5432;
  let inngestPort = 8288;
  const dbPortOpen = await isPortOpen(postgresPort);
  const inngestPortOpen = await isPortOpen(inngestPort);

  if (!dbPortOpen) {
    postgresPort = (await getNextOpenPort(postgresPort)) as number;
  }

  if (!inngestPortOpen) {
    inngestPort = (await getNextOpenPort(inngestPort)) as number;
  }

  return { postgresPort, inngestPort };
}

function sanitizeForDockerName(name: string): string {
  // Convert to lowercase
  let sanitized = name.toLowerCase();

  // Replace any non-alphanumeric characters (excluding dashes) with dashes
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

  // Trim dashes from the start and end
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Ensure name is between 2 and 255 characters
  if (sanitized.length < 2) {
    throw new Error('Name must be at least 2 characters long.');
  }
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}

import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import prompt from 'prompt';
import { check } from 'tcp-port-used';

import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';
import { replaceValuesInFile } from '../utils.js';

export async function provision(projectName: string) {
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort, inngestPort } = await getInfraPorts();

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

  prompt.start();
  const { dbUrl, inngestUrl } = await prompt.get({
    properties: {
      dbUrl: {
        description:
          'Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(postgresql:\/\/.*|)$/,
        message: 'Please enter a valid PostgreSQL connection string or leave blank',
        required: false,
      },
      inngestUrl: {
        description: 'Enter your Inngest server URL or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(https?:\/\/.*|)$/,
        message: 'Please enter a valid URL or leave blank',
        required: false,
      },
    },
  });

  let inngestServerUrl: string;
  let shouldRunDocker = false;
  let connectionString = `postgresql://postgres:postgres@localhost:${postgresPort}/arkwright?schema=arkw`;

  if (dbUrl === '' && inngestUrl === '') {
    console.log('Creating new PostgreSQL instance and Inngest server...');
    copyStarterFile('starter-docker-compose.yaml', 'docker-compose.yaml');
    replaceValuesInFile({
      filePath: 'docker-compose.yaml',
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
        { replace: `${inngestPort}`, search: 'REPLACE_INNGEST_PORT' },
      ],
    });

    inngestServerUrl = `http://localhost:${inngestPort}`;
    shouldRunDocker = true;
  } else if (dbUrl === '' && inngestUrl !== '') {
    console.log('Setting up new Inngest server...');
    copyStarterFile('starter-docker-compose-postgres.yaml', 'docker-compose.yaml');
    replaceValuesInFile({
      filePath: 'docker-compose.yaml',
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
        { replace: `${inngestPort}`, search: 'REPLACE_INNGEST_PORT' },
      ],
    });
    inngestServerUrl = String(inngestUrl);

    shouldRunDocker = true;
  } else if (dbUrl !== '' && inngestUrl === '') {
    throw new Error('Remote Inngest cannot reach local database');
  } else {
    inngestServerUrl = String(inngestUrl);
    connectionString = String(dbUrl);
  }

  if (shouldRunDocker) {
    console.log('Starting Docker containers...');
    try {
      await execa('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
      console.log('Docker containers started successfully.');
    } catch (error) {
      console.error('Failed to start Docker containers:', error);
      throw error;
    }
  }

  return { connectionString, inngestServerUrl };
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

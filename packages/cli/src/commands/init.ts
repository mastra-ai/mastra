import { execa, ExecaError } from 'execa';
import fs from 'fs';
import isPortReachable from 'is-port-reachable';
import net from 'net';
import Module from 'node:module';
import path from 'path';
import process from 'process';
import prompt from 'prompt';

import fse from 'fs-extra/esm';

import { startNextDevServer } from './dev.js';

const require = Module.createRequire(import.meta.url);

function _init() {
  try {
    // Check to make sure a package.json file exists..
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log('No package.json file found in the current directory');
      return false;
    }

    // Check to make sure `@arkw/core` is installed.
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (!packageJson.dependencies || !packageJson.dependencies['@arkw/core']) {
      console.log('Please install @arkw/core before running this command (npm install @arkw/core)');
      return false;
    }

    createBlueprintDir();
    const config = copyStarterFile('starter-config.ts', 'arkw.config.ts');

    return config;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function migrate(createOnly = false, dbUrl: string) {
  console.log('Migrating database...');
  try {
    const PRISMA_BIN = path.resolve(
      process.cwd(),
      'node_modules',
      '@arkw/core',
      'node_modules',
      'prisma',
      'node_modules',
      '.bin',
    );

    const PRISMA_SCHEMA = path.resolve(process.cwd(), 'node_modules', '@arkw/core', 'src', 'prisma', 'schema.prisma');

    const CREATE_ONLY = createOnly ? `--create-only` : ``;

    const migrateCommand = execa(
      `${PRISMA_BIN}/prisma migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`,
      {
        env: {
          ...process.env,
          DB_URL: dbUrl,
        },
        shell: true,
        all: true,
        stdio: 'inherit', // This will pipe directly to parent process stdout/stderr
      },
    );

    await migrateCommand;

    console.log('Congrats! Your project is ready to go.');
    return true;
  } catch (error: any) {
    if (error instanceof ExecaError) {
      console.log(error);
    }
    console.log(`Error: ${error.message}`, true);
    if (error.stderr) {
      console.log(`stderr: ${error.stderr}`, true);
    }
  }
  return false;
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

export async function init() {
  console.log('Initializing project...');
  const projectName = getProjectName();
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort, inngestPort } = await getInfraPorts();

  if (!_init()) return;

  replaceEnvInConfig({ postgresPort, filePath: 'arkw.config.ts' });

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
    replaceEnvDockerCompose({
      projectName: sanitizedProjectName,
      filePath: 'docker-compose.yaml',
      postgresPort,
      inngestPort,
    });

    inngestServerUrl = `http://localhost:${inngestPort}`;
    shouldRunDocker = true;
  } else if (dbUrl === '' && inngestUrl !== '') {
    console.log('Setting up new Inngest server...');
    copyStarterFile('starter-docker-compose-postgres.yaml', 'docker-compose.yaml');
    replaceEnvDockerCompose({
      projectName: sanitizedProjectName,
      filePath: 'docker-compose.yaml',
      postgresPort,
      inngestPort,
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
      let portOpen = false;
      while (!portOpen) {
        portOpen = await isPortReachable(postgresPort, { host: 'localhost', timeout: 10000 });
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Docker containers started successfully.');
    } catch (error) {
      console.error('Failed to start Docker containers:', error);
      return;
    }
  }

  await migrate(false, connectionString);

  // add values to process.env
  process.env.INNGEST_URL = inngestServerUrl;
  process.env.DB_URL = connectionString;

  await startNextDevServer();
}

function copyStarterFile(inputFile: string, outputFile: string) {
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

function createBlueprintDir() {
  const dirPath = path.join(process.cwd(), 'arkw-blueprints');
  if (fs.existsSync(dirPath)) {
    console.log(`Blueprint folder already exists`);
    return;
  }
  fs.mkdirSync(dirPath);
}

function getProjectName() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = require(packageJsonPath);
  return pkg.name;
}

const isPortOpen = async (port: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let s = net.createServer();
    s.once('error', (err: any) => {
      s.close();
      if (err['code'] == 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false); // or throw error!!
        // reject(err);
      }
    });
    s.once('listening', () => {
      resolve(true);
      s.close();
    });
    s.listen(port);
  });
};

const getNextOpenPort = async (startFrom: number = 2222) => {
  let openPort = null;
  while (startFrom < 65535 || !!openPort) {
    if (await isPortOpen(startFrom)) {
      openPort = startFrom;
      break;
    }
    startFrom++;
  }
  return openPort;
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

function replaceEnvDockerCompose({
  postgresPort,
  inngestPort,
  projectName,
  filePath,
}: {
  postgresPort: number;
  inngestPort: number;
  projectName: string;
  filePath: string;
}) {
  let dockerComposeContent = fs.readFileSync(filePath, 'utf8');
  dockerComposeContent = dockerComposeContent.replace(/REPLACE_PROJECT_NAME/g, projectName);

  dockerComposeContent = dockerComposeContent.replace(/REPLACE_DB_PORT/g, `${postgresPort}`);
  dockerComposeContent = dockerComposeContent.replace(/REPLACE_INNGEST_PORT/g, `${inngestPort}`);

  fs.writeFileSync(filePath, dockerComposeContent);
}

function replaceEnvInConfig({ postgresPort, filePath }: { postgresPort: number; filePath: string }) {
  let configContent = fs.readFileSync(filePath, 'utf8');
  configContent = configContent.replace(/REPLACE_DB_PORT/g, `${postgresPort}`);
  fs.writeFileSync('arkw.config.ts', configContent);
}

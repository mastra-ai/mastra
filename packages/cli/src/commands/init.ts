import { execa, ExecaError } from 'execa';
import fs from 'fs';
import path from 'path';
import process from 'process';
import prompt from 'prompt';

import fse from 'fs-extra/esm';

import { startNextDevServer } from './dev.js';

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

export async function init() {
  console.log('Initializing project...');
  if (!_init()) return;

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

  let connectionString: string;
  let inngestServerUrl: string;
  let shouldRunDocker = false;

  if (dbUrl === '' && inngestUrl === '') {
    console.log('Creating new PostgreSQL instance and Inngest server...');
    copyStarterFile('starter-docker-compose.yaml', 'docker-compose.yaml');
    connectionString = 'postgresql://postgres:postgres@localhost:5432/arkwright';
    inngestServerUrl = 'http://localhost:8288';
    shouldRunDocker = true;
  } else if (dbUrl === '' && inngestUrl !== '') {
    console.log('Setting up new Inngest server...');
    copyStarterFile('starter-docker-compose-postgres.yaml', 'docker-compose.yaml');
    inngestServerUrl = String(inngestUrl);
    connectionString = 'postgresql://postgres:postgres@localhost:5432/arkwright';
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

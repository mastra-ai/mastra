import fs from 'fs'
import fse from 'fs-extra/esm'
import path from 'path'

import process from 'process';
import {execa, ExecaError} from 'execa';

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
    if (!packageJson.dependencies || !packageJson.dependencies['core']) {
      console.log(
        'Please install @arkw/core before running this command (npm install @arkw/core)',
      );
      return false;
    }

    const config = copyStarterFile("starter-config.ts", "arkw.config.ts");
    copyStarterFile("starter-docker-compose.yaml", "docker-compose.yaml");

    return config;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function migrate(createOnly = false) {
  console.log('Migrating database...');
  try {
    // TODO: prompt user for db URL or create sqllite db

    const PRISMA_BIN = path.resolve(process.cwd(), "node_modules", "core", "node_modules","prisma","node_modules",".bin");

    const PRISMA_SCHEMA = path.resolve(process.cwd(),"node_modules","core","src","prisma","schema.prisma");

    const CREATE_ONLY = createOnly ? `--create-only` : ``;

    const migrateCommand = execa(
      `${PRISMA_BIN}/prisma migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`,
      {
        env: {
          ...process.env,
          FUTURE_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/arkwright?schema=public",
          DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/arkwright?schema=public",
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

export function init() {
  console.log('Initializing project...');
  _init();
  
  migrate();

  return;
}

function copyStarterFile(inputFile: string, outputFile: string) {
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, "..", "..", "src","files", inputFile);
  const fileString = fs.readFileSync(filePath, 'utf8');

  const outputFilePath = path.join(process.cwd(), outputFile);
  if(fs.existsSync(outputFilePath)) {
    console.log(`${outputFile} already exists`);
    return false;
  }

  fse.outputFileSync(outputFilePath, fileString);
  return fileString;
}
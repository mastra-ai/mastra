import fs from 'fs';
import Module from 'node:module';
import path from 'path';
import process from 'process';

import getPackageManager from '../utils/getPackageManager.js';

import { startNextDevServer } from './dev.js';
import { migrate } from './migrate.js';
import { provision, copyStarterFile, setupEnvFile } from './provision.js';

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

export async function init() {
  console.log('Initializing project...');
  const projectName = getProjectName();

  if (!_init()) return;

  const { connectionString, inngestServerUrl } = await provision(projectName);

  await migrate(false, connectionString);

  await setupEnvFile({
    dbUrl: connectionString,
    inngestUrl: inngestServerUrl,
  });

  await startNextDevServer();
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

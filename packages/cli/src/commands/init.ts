import fs from 'fs';
import Module from 'node:module';
import path from 'path';
import process from 'process';
import vm from 'vm';

import { startNextDevServer } from './dev.js';
import { migrate } from './migrate.js';
import { provision, setupEnvFile, setupRoutesFile } from './provision.js';

const require = Module.createRequire(import.meta.url);

export async function init() {
  console.log('Initializing project...');

  if (!checkDependencies()) return;

  createBlueprintDir();

  const projectName = getProjectName();

  const { dbUrl, inngestUrl } = await provision(projectName);

  await migrate(false, dbUrl);
  await setupEnvFile({
    dbUrl,
    inngestUrl,
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

function checkDependencies() {
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

    if (fs.existsSync(path.join(process.cwd(), 'arkw.config.ts'))) {
      console.log('arkwright config file already exists');
      return false;
    }

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}


import fs from 'fs';
import Module from 'node:module';
import path from 'path';
import process from 'process';

import { startNextDevServer } from './dev.js';
import { migrate } from './migrate.js';
import { provision, setupEnvFile } from './provision.js';

const require = Module.createRequire(import.meta.url);

export async function init() {
  console.log('Initializing project...');

  if (!checkDependencies()) return;

  const projectName = getProjectName();

  const { dbUrl, inngestUrl } = await provision(projectName);

  await migrate(false, dbUrl);
  await setupEnvFile({
    dbUrl,
    inngestUrl,
  });

  createBlueprintDir();
  await startNextDevServer();
}

function createBlueprintDir() {
  const dirPath = path.join(process.cwd(), 'mastra-blueprints');
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

    // Check to make sure `@mastra/core` is installed.
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (!packageJson.dependencies || !packageJson.dependencies['@mastra/core']) {
      console.log('Please install @mastra/core before running this command (npm install @mastra/core)');
      return false;
    }

    if (fs.existsSync(path.join(process.cwd(), 'mastra.config.ts'))) {
      console.log('mastra config file already exists');
      return false;
    }

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

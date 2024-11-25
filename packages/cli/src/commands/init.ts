import fs from 'node:fs/promises';
import path from 'path';
import process from 'process';
import yoctoSpinner from 'yocto-spinner';

const spinner = yoctoSpinner({ text: 'Initializing project\n' });
export async function init() {
  spinner.start();

  const message = await checkDependencies();
  if (message) {
    spinner.error(message);
    return;
  }

  const isInitialized = await checkInitialization();

  if (isInitialized) {
    spinner.success('Mastra already initialized');
    return;
  }

  try {
    await createMastraDir();
    await writeIndexFile();
    await createAgentDir();
    await writeTestAgent();
    spinner.success('Mastra initialized successfully');
  } catch (err) {
    spinner.error('Could not initialize mastra');
    console.error(err);
  }
}

async function createMastraDir() {
  const dirPath = path.join(process.cwd(), 'src', 'mastra');
  try {
    await fs.access(dirPath);
  } catch (err) {
    fs.mkdir(dirPath);
  }
}

async function createAgentDir() {
  const dirPath = path.join(process.cwd(), 'src', 'mastra', 'agents');
  try {
    await fs.access(dirPath);
  } catch (err) {
    try {
      await fs.mkdir(dirPath);
    } catch (err) {
      throw err;
    }
  }
}

async function writeIndexFile() {
  const destPath = path.join(process.cwd(), 'src', 'mastra', 'index.ts');
  try {
    await fs.writeFile(destPath, '');
    await fs.writeFile(
      destPath,
      `
import { Mastra, createLogger } from '@mastra/core';

import { agentOne, agentTwo } from './agents/agent';

export const mastra = new Mastra({
  agents: [agentOne, agentTwo],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
`,
    );
  } catch (err) {
    throw err;
  }
}

async function writeTestAgent() {
  const destPath = path.join(process.cwd(), 'src', 'mastra', 'agents', 'agent.ts');
  try {
    fs.writeFile(destPath, '');
    fs.writeFile(
      destPath,
      `
import { Agent } from '@mastra/core';

export const agentOne = new Agent({
  name: 'Agent One',
  instructions: 'You know about basketball, specifically the NBA. You are a sports analyst.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20240620',
    toolChoice: 'auto',
  },
});

export const agentTwo = new Agent({
  name: 'Agent Two',
  instructions: 'Do this',
  model: {
    provider: 'GROQ',
    name: 'llama3-groq-70b-8192-tool-use-preview',
    toolChoice: 'auto',
  },
});
    `,
    );
  } catch (err) {
    throw err;
  }
}

async function checkInitialization() {
  const dirPath = path.join(process.cwd(), 'mastra');
  try {
    await fs.access(dirPath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
  }
}

function getProjectName() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = require(packageJsonPath);
  return pkg.name;
}

async function checkDependencies() {
  try {
    // Check to make sure a package.json file exists..
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    try {
      await fs.access(packageJsonPath);
    } catch {
      return 'No package.json file found in the current directory';
    }

    // Check to make sure `@mastra/core` is installed.
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    if (!packageJson.dependencies || !packageJson.dependencies['@mastra/core']) {
      return 'Please install @mastra/core before running this command (npm install @mastra/core)';
    }

    // check for existence of index file
    // const configPath = path.join(process.cwd(), 'mastra', 'index.ts');
    // try {
    //   await fs.access(configPath);
    //   return 'Mastra config file already exists';
    // } catch(err){
    //   throw err
    // }

    return '';
  } catch (err) {
    console.error(err);
    return 'Could not check dependencies';
  }
}

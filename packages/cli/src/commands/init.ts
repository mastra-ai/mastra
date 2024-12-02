import { ModelConfig } from '@mastra/core';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'path';
import process from 'process';
import yoctoSpinner from 'yocto-spinner';

import fsExtra from 'fs-extra/esm';

type LLMProvider = 'open-ai' | 'anthropic' | 'groq';
const s = yoctoSpinner({ text: 'Initializing project\n' });
export async function init({
  directory,
  addExample,
  components,
  llmProvider,
}: {
  directory: string;
  components: string[];
  llmProvider: LLMProvider;
  addExample: boolean;
}) {
  // s.start('Initializing Mastra\n');

  const message = await checkDependencies();

  if (message) {
    s.stop(message);
    return;
  }

  const isInitialized = await checkInitialization();

  if (isInitialized) {
    s.stop('Mastra already initialized');
    return;
  }

  try {
    const dirPath = await createMastraDir(directory);
    await writeIndexFile(dirPath, addExample);
    await Promise.all(components.map(component => createComponentsDir(dirPath, component)));
    await writeAPIKey(llmProvider);
    if (addExample) {
      await writeTestAgent(dirPath, llmProvider);
    }

    // s.success('Mastra initialized successfully');
  } catch (err) {
    s.error('Could not initialize mastra');
    console.error(err);
  }
}

async function writeAPIKey(provider: LLMProvider) {
  let key = 'OPENAI_API_KEY';
  switch (provider) {
    case 'anthropic':
      key = 'ANTHROPIC_API_KEY';
      return;
    case 'groq':
      key = 'GROQ_API_KEY';
      return;
    default:
      key = 'OPENAI_API_KEY';
  }
  execSync(`echo ${key}= >> .env.development`);
}
async function createMastraDir(directory: string) {
  let dir = directory
    .trim()
    .split('/')
    .filter(item => item !== '');

  const dirPath = path.join(process.cwd(), ...dir, 'mastra');

  await fsExtra.ensureDir(dirPath);
  return dirPath;
}

async function createComponentsDir(dirPath: string, component: string) {
  const componentPath = dirPath + `/${component}`;

  await fsExtra.ensureDir(componentPath);
}

async function writeIndexFile(dirPath: string, addExample: boolean) {
  const indexPath = dirPath + '/index.ts';
  const destPath = path.join(indexPath);
  try {
    await fs.writeFile(destPath, '');
    if (!addExample) {
      await fs.writeFile(
        destPath,
        `
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({})
        `,
      );

      return;
    }
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

const modelToConfigMap: Record<LLMProvider, ModelConfig> = {
  'open-ai': { provider: 'OPEN_AI', name: 'gpt-4o', toolChoice: 'auto' },
  anthropic: { provider: 'ANTHROPIC', name: 'claude-3-5-sonnet-20241022', toolChoice: 'auto' },
  groq: { provider: 'GROQ', name: 'llama3-groq-70b-8192-tool-use-preview', toolChoice: 'auto' },
};

async function writeTestAgent(dirPath: string, llmProvider: LLMProvider) {
  const destPath = dirPath + '/agents/agent.ts';

  const model = modelToConfigMap[llmProvider];
  try {
    fs.writeFile(destPath, '');
    fs.writeFile(
      destPath,
      `
import { Agent } from '@mastra/core';

export const agentOne = new Agent({
  name: 'Agent One',
  instructions: 'You know about basketball, specifically the NBA. You are a sports analyst.',
  model: ${model},
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
    return false;
  }
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

import { ModelConfig } from '@mastra/core';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'path';
import prettier from 'prettier';
import process from 'process';
import yoctoSpinner from 'yocto-spinner';

import fsExtra from 'fs-extra/esm';

import { copyStarterFile } from '../utils.js';

type LLMProvider = 'openai' | 'anthropic' | 'groq';
type Components = 'agents' | 'workflows' | 'tools';

const s = yoctoSpinner({ text: 'Initializing project\n' });

const modelToConfigMap: Record<LLMProvider, ModelConfig> = {
  openai: { provider: 'OPEN_AI', name: 'gpt-4o', toolChoice: 'auto' },
  anthropic: { provider: 'ANTHROPIC', name: 'claude-3-5-sonnet-20241022', toolChoice: 'auto' },
  groq: { provider: 'GROQ', name: 'llama3-groq-70b-8192-tool-use-preview', toolChoice: 'auto' },
};

async function writeAgentSample(llmProvider: LLMProvider, destPath: string) {
  const model = modelToConfigMap[llmProvider];
  const content = `
import { Agent } from '@mastra/core';

export const catOne = new Agent({
  name: 'cat-one',
  instructions: 'You are a feline expert with comprehensive knowledge of all cat species, from domestic breeds to wild big cats. As a lifelong cat specialist, you understand their behavior, biology, social structures, and evolutionary history in great depth.',
  model: ${JSON.stringify(model, null, 2)},
});
    `;
  const formattedContent = await prettier.format(content, {
    parser: 'typescript',
    singleQuote: true,
  });

  await fs.writeFile(destPath, '');
  await fs.writeFile(destPath, formattedContent);
}

async function writeWorkflowSample(destPath: string) {
  await copyStarterFile('workflow.ts', destPath);
}

async function writeCodeSampleForComponents(llmprovider: LLMProvider, component: Components, destPath: string) {
  switch (true) {
    case component === 'agents':
      return writeAgentSample(llmprovider, destPath);
    case component === 'tools':
      return '';
    case component === 'workflows':
      return writeWorkflowSample(destPath);
    default:
      return '';
  }
}

async function writeCodeSample(dirPath: string, component: Components, llmProvider: LLMProvider) {
  const destPath = dirPath + `/${component}/index.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath);
  } catch (err) {
    throw err;
  }
}

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
  spinner?: any;
}) {
  // s.start('Initializing Mastra\n');

  const depCheck = await checkDependencies();

  if (depCheck !== 'ok') {
    s.stop(depCheck);
    return;
  }

  const isInitialized = await checkInitialization();

  if (isInitialized) {
    s.stop('Mastra already initialized');
    return;
  }

  try {
    const dirPath = await createMastraDir(directory);
    await Promise.all([
      writeIndexFile(dirPath, addExample),
      ...components.map(component => createComponentsDir(dirPath, component)),
      writeAPIKey(llmProvider),
    ]);

    if (addExample) {
      await Promise.all([components.map(component => writeCodeSample(dirPath, component as Components, llmProvider))]);
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

import { catOne } from './agents/index';

export const mastra = new Mastra({
  agents: [catOne],
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
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    try {
      await fs.access(packageJsonPath);
    } catch {
      return 'No package.json file found in the current directory';
    }

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    if (!packageJson.dependencies || !packageJson.dependencies['@mastra/core']) {
      return 'Please install @mastra/core before running this command (npm install @mastra/core)';
    }

    return 'ok';
  } catch (err) {
    console.error(err);
    return 'Could not check dependencies';
  }
}

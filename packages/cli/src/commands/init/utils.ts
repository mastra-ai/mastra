import * as p from '@clack/prompts';
import { ModelConfig } from '@mastra/core';
import { execSync } from 'node:child_process';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'path';
import color from 'picocolors';
import prettier from 'prettier';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { copyStarterFile } from '../../utils/copy-starter-file.js';
import { logger } from '../../utils/logger.js';

import { init } from './init.js';

const exec = util.promisify(child_process.exec);

export type LLMProvider = 'openai' | 'anthropic' | 'groq';
export type Components = 'agents' | 'workflows' | 'tools';

export const modelToConfigMap: Record<LLMProvider, ModelConfig> = {
  openai: { provider: 'OPEN_AI', name: 'gpt-4o', toolChoice: 'auto' },
  anthropic: { provider: 'ANTHROPIC', name: 'claude-3-5-sonnet-20241022', toolChoice: 'auto' },
  groq: { provider: 'GROQ', name: 'llama3-groq-70b-8192-tool-use-preview', toolChoice: 'auto' },
};

export async function writeAgentSample(llmProvider: LLMProvider, destPath: string) {
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

export async function writeWorkflowSample(destPath: string) {
  await copyStarterFile('workflow.ts', destPath);
}

export async function writeToolSample(destPath: string) {
  await copyStarterFile('tools.ts', destPath);
}

export async function writeCodeSampleForComponents(llmprovider: LLMProvider, component: Components, destPath: string) {
  switch (true) {
    case component === 'agents':
      return writeAgentSample(llmprovider, destPath);
    case component === 'tools':
      return writeToolSample(destPath);
    case component === 'workflows':
      return writeWorkflowSample(destPath);
    default:
      return '';
  }
}

export async function createComponentsDir(dirPath: string, component: string) {
  const componentPath = dirPath + `/${component}`;

  await fsExtra.ensureDir(componentPath);
}

export async function writeIndexFile(dirPath: string, addExample: boolean) {
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

export async function checkInitialization() {
  const dirPath = path.join(process.cwd(), 'mastra');
  try {
    await fs.access(dirPath);
    return true;
  } catch (err) {
    return false;
  }
}

export async function checkDependencies() {
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

export async function writeAPIKey(provider: LLMProvider) {
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
export async function createMastraDir(directory: string) {
  let dir = directory
    .trim()
    .split('/')
    .filter(item => item !== '');

  const dirPath = path.join(process.cwd(), ...dir, 'mastra');

  await fsExtra.ensureDir(dirPath);
  return dirPath;
}

export async function writeCodeSample(dirPath: string, component: Components, llmProvider: LLMProvider) {
  const destPath = dirPath + `/${component}/index.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath);
  } catch (err) {
    throw err;
  }
}

export async function interactivePrompt() {
  console.clear();

  p.intro(color.inverse(' Mastra Init '));

  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: src/)',
          placeholder: 'src/',
          defaultValue: 'src/',
        }),
      components: () =>
        p.multiselect({
          message: 'Choose components to install:',
          options: [
            { value: 'agents', label: 'Agents', hint: 'recommended' },
            {
              value: 'workflows',
              label: 'Workflows',
            },
          ],
        }),
      shouldAddTools: () =>
        p.confirm({
          message: 'Add tools?',
          initialValue: false,
        }),
      llmProvider: () =>
        p.select({
          message: 'Select default provider:',
          options: [
            { value: 'openai', label: 'OpenAI', hint: 'recommended' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'groq', label: 'Groq' },
          ],
        }),
      addExample: () =>
        p.confirm({
          message: 'Add example',
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  const s = p.spinner();

  s.start('Initializing Mastra');

  const { shouldAddTools, components, ...rest } = mastraProject;
  const mastraComponents = shouldAddTools ? [...components, 'tools'] : components;
  try {
    const result = { ...rest, components: mastraComponents };
    await init(result);

    s.stop('Mastra initialized successfully');
    p.note('You are all set!');

    p.outro(`Problems? ${color.underline(color.cyan('https://github.com/mastra-ai/mastra'))}`);
  } catch (err) {
    s.stop('Could not initialize Mastra');
    logger.error(err as string);
  }
}

export async function initializeMinimal() {
  logger.break();
  p.intro(color.bgCyan(color.black(' Starter ')));

  const confirm = await p.confirm({
    message: "You don't have a package.json, do you want to install a starter?",
    initialValue: true,
  });

  if (p.isCancel(confirm)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  if (!confirm) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const s = p.spinner();
  s.start('Installing dependencies');

  await exec(`npm init -y`);
  await exec(`npm i zod@3.23.7 typescript tsx @types/node --save-dev >> output.txt`);
  await exec(`echo output.txt >> .gitignore`);
  await exec(`echo node_modules >> .gitignore`);
  await exec(`npm i @mastra/core@alpha`);

  s.stop('Dependencies installed');
  logger.break();
}

export async function checkPkgJsonAndCreateStarter() {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  let isPkgJsonPresent = false;

  try {
    await fsExtra.readJSON(pkgJsonPath);
    isPkgJsonPresent = true;
  } catch (err) {
    isPkgJsonPresent = false;
  }

  if (!isPkgJsonPresent) {
    await initializeMinimal();
  }
}
import * as p from '@clack/prompts';
import type { ModelConfig } from '@mastra/core/llm';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'path';
import color from 'picocolors';
import prettier from 'prettier';
import yoctoSpinner from 'yocto-spinner';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { DepsService } from '../../services/service.deps';
import { FileService } from '../../services/service.file';
import { logger } from '../../utils/logger';

const exec = util.promisify(child_process.exec);

export type LLMProvider = 'openai' | 'anthropic' | 'groq';
export type Components = 'agents' | 'workflows' | 'tools';

export const modelToConfigMap: Record<LLMProvider, ModelConfig> = {
  openai: { provider: 'OPEN_AI', name: 'gpt-4o', toolChoice: 'auto' },
  anthropic: { provider: 'ANTHROPIC', name: 'claude-3-5-sonnet-20241022', toolChoice: 'auto' },
  groq: { provider: 'GROQ', name: 'llama3-groq-70b-8192-tool-use-preview', toolChoice: 'auto' },
};

export async function writeAgentSample(llmProvider: LLMProvider, destPath: string, addExampleTool: boolean) {
  const model = modelToConfigMap[llmProvider];
  const instructions = `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      ${addExampleTool ? 'Use the weatherTool to fetch current weather data.' : ''}
`;
  const content = `
import { Agent } from '@mastra/core/agent';
${addExampleTool ? `import { weatherTool } from '../tools';` : ''}

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: \`${instructions}\`,
  model: ${JSON.stringify(model, null, 2)},
  ${addExampleTool ? 'tools: { weatherTool },' : ''}
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
  const fileService = new FileService();
  await fileService.copyStarterFile('workflow.ts', destPath);
}

export async function writeToolSample(destPath: string) {
  const fileService = new FileService();
  await fileService.copyStarterFile('tools.ts', destPath);
}

export async function writeCodeSampleForComponents(
  llmprovider: LLMProvider,
  component: Components,
  destPath: string,
  components: Components[],
) {
  switch (component) {
    case 'agents':
      return writeAgentSample(llmprovider, destPath, components.includes('tools'));
    case 'tools':
      return writeToolSample(destPath);
    case 'workflows':
      return writeWorkflowSample(destPath);
    default:
      return '';
  }
}

export const createComponentsDir = async (dirPath: string, component: string) => {
  const componentPath = dirPath + `/${component}`;

  await fsExtra.ensureDir(componentPath);
};

export const writeIndexFile = async ({
  dirPath,
  addAgent,
  addExample,
  addWorkflow,
}: {
  dirPath: string;
  addExample: boolean;
  addWorkflow: boolean;
  addAgent: boolean;
}) => {
  const indexPath = dirPath + '/index.ts';
  const destPath = path.join(indexPath);
  try {
    await fs.writeFile(destPath, '');
    const filteredExports = [
      addWorkflow ? `workflows: { weatherWorkflow },` : '',
      addAgent ? `agents: { weatherAgent },` : '',
    ].filter(Boolean);
    if (!addExample) {
      await fs.writeFile(
        destPath,
        `
import { Mastra } from '@mastra/core';

export const mastra = new Mastra()
        `,
      );

      return;
    }
    await fs.writeFile(
      destPath,
      `
import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core';
${addWorkflow ? `import { weatherWorkflow } from './workflows';` : ''}
${addAgent ? `import { weatherAgent } from './agents';` : ''}

export const mastra = new Mastra({
  ${filteredExports.join('\n  ')}
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
`,
    );
  } catch (err) {
    throw err;
  }
};

export const checkInitialization = async (dirPath: string) => {
  try {
    await fs.access(dirPath);
    return true;
  } catch (err) {
    return false;
  }
};

export const checkAndInstallCoreDeps = async () => {
  const depsService = new DepsService();
  const depCheck = await depsService.checkDependencies(['@mastra/core']);

  if (depCheck !== 'ok') {
    await installCoreDeps();
  }
};

const spinner = yoctoSpinner({ text: 'Installing Mastra core dependencies\n' });
export async function installCoreDeps() {
  try {
    const confirm = await p.confirm({
      message: 'You do not have the @mastra/core package installed. Would you like to install it?',
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    if (!confirm) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    spinner.start();

    const depsService = new DepsService();

    await depsService.installPackages(['@mastra/core@alpha']);
    spinner.success('@mastra/core installed successfully');
  } catch (err) {
    console.error(err);
  }
}

export const getAPIKey = async (provider: LLMProvider) => {
  let key = 'OPENAI_API_KEY';
  switch (provider) {
    case 'anthropic':
      key = 'ANTHROPIC_API_KEY';
      return key;
    case 'groq':
      key = 'GROQ_API_KEY';
      return key;
    default:
      return key;
  }
};

export const writeAPIKey = async ({
  provider,
  apiKey = 'your-api-key',
}: {
  provider: LLMProvider;
  apiKey?: string;
}) => {
  const key = await getAPIKey(provider);
  await exec(`echo ${key}=${apiKey} >> .env.development`);
};
export const createMastraDir = async (directory: string): Promise<{ ok: true; dirPath: string } | { ok: false }> => {
  let dir = directory
    .trim()
    .split('/')
    .filter(item => item !== '');

  const dirPath = path.join(process.cwd(), ...dir, 'mastra');

  try {
    await fs.access(dirPath);
    return { ok: false };
  } catch {
    await fsExtra.ensureDir(dirPath);
    return { ok: true, dirPath };
  }
};

export const writeCodeSample = async (
  dirPath: string,
  component: Components,
  llmProvider: LLMProvider,
  components: Components[],
) => {
  const destPath = dirPath + `/${component}/index.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath, components);
  } catch (err) {
    throw err;
  }
};

export const interactivePrompt = async () => {
  p.intro(color.inverse('Mastra Init'));
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
      llmApiKey: async ({ results: { llmProvider } }) => {
        const keyChoice = await p.select({
          message: `Enter your ${llmProvider} API key?`,
          options: [
            { value: 'skip', label: 'Skip for now', hint: 'default' },
            { value: 'enter', label: 'Enter API key' },
          ],
          initialValue: 'skip',
        });

        if (keyChoice === 'enter') {
          return p.text({
            message: 'Enter your API key:',
            placeholder: 'sk-...',
          });
        }
        return undefined;
      },
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

  const { shouldAddTools, components, ...rest } = mastraProject;
  const mastraComponents = shouldAddTools ? [...components, 'tools'] : components;

  return { ...rest, components: mastraComponents };
};

export const checkPkgJson = async () => {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  let isPkgJsonPresent = false;

  try {
    await fsExtra.readJSON(pkgJsonPath);
    isPkgJsonPresent = true;
  } catch (err) {
    isPkgJsonPresent = false;
  }

  if (isPkgJsonPresent) {
    return;
  }

  logger.debug('no package.json found, create one or run "mastra create" to create a new project');
  process.exit(0);
};

import fs from 'fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'path';
import * as p from '@clack/prompts';
import fsExtra from 'fs-extra/esm';
import color from 'picocolors';
import prettier from 'prettier';
import shellQuote from 'shell-quote';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import {
  cursorGlobalMCPConfigPath,
  globalMCPIsAlreadyInstalled,
  windsurfGlobalMCPConfigPath,
} from './mcp-docs-server-install';

const exec = util.promisify(child_process.exec);

export type LLMProvider = 'openai' | 'anthropic' | 'groq' | 'google' | 'cerebras' | 'mistral';
export type Components = 'agents' | 'workflows' | 'tools';

export const getModelIdentifier = (llmProvider: LLMProvider) => {
  if (llmProvider === 'openai') {
    return `'openai/gpt-4o-mini'`;
  } else if (llmProvider === 'anthropic') {
    return `'anthropic/claude-3-5-sonnet-20241022'`;
  } else if (llmProvider === 'groq') {
    return `'groq/llama-3.3-70b-versatile'`;
  } else if (llmProvider === 'google') {
    return `'google/gemini-2.5-pro'`;
  } else if (llmProvider === 'cerebras') {
    return `'cerebras/llama-3.3-70b'`;
  } else if (llmProvider === 'mistral') {
    return `'mistral/mistral-medium-2508'`;
  }
};

// Resolve a template file from templates/weather-agent/src/mastra
const readWeatherTemplateFile = async (subpath: string): Promise<string> => {
  // Use import.meta.url so this works in ESM
  const __filename = (await import('url')).fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templateRoot = path.resolve(__dirname, '../../../../../templates/weather-agent/src/mastra');
  const sourcePath = path.join(templateRoot, subpath);
  return await fs.readFile(sourcePath, 'utf8');
};

const formatTypescript = async (content: string) =>
  prettier.format(content, { parser: 'typescript', singleQuote: true, semi: true });

export async function writeAgentSample(llmProvider: LLMProvider, destPath: string, addExampleTool: boolean) {
  const modelString = getModelIdentifier(llmProvider);

  // Start from the weather-agent template and transform
  let content = await readWeatherTemplateFile('agents/index.ts');

  // Remove ai-sdk provider imports (we will use string model identifiers)
  content = content.replace(/\n?import\s*\{\s*openai\s*\}\s*from\s*['"]@ai-sdk\/openai['"];?\n?/g, '\n');
  content = content.replace(/\n?import\s*\{\s*anthropic\s*\}\s*from\s*['"]@ai-sdk\/anthropic['"];?\n?/g, '\n');

  if (addExampleTool) {
    content = content.replace(/from\s*['"]\.\.\/tools['"]/g, "from '../tools/weather-tool'");
  } else {
    // Remove weatherTool import and tools property
    content = content.replace(/\n?import\s*\{\s*weatherTool\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '\n');
    content = content.replace(/\n\s*tools:\s*\{\s*weatherTool\s*\}\s*,?/g, '\n');
  }

  // Remove any workflow import/property from agent (agent no longer configures workflows)
  content = content.replace(/\n?import\s*\{\s*weatherWorkflow\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '\n');
  content = content.replace(/\n\s*workflows:\s*\{\s*weatherWorkflow\s*\}\s*,?/g, '\n');

  // Replace model array/object with single model string identifier
  // Replace arrays like: model: [ ... ],
  content = content.replace(/model:\s*\[[\s\S]*?\],?/m, `model: ${modelString},`);
  // Also cover a possible single provider call: model: openai('...'),
  content = content.replace(/model:\s*[^,]+,/m, `model: ${modelString},`);

  const formattedContent = await formatTypescript(content);

  await fs.writeFile(destPath, formattedContent);
}

export async function writeWorkflowSample(destPath: string) {
  // Start from template then transform import paths to generated files
  let content = await readWeatherTemplateFile('workflows/index.ts');

  // Point imports to specific files we generate
  content = content.replace(/from\s*['"]\.\.\/agents['"]/g, "from '../agents/weather-agent'");
  content = content.replace(/from\s*['"]\.\.\/tools['"]/g, "from '../tools/weather-tool'");

  const formattedContent = await formatTypescript(content);
  await fs.writeFile(destPath, formattedContent);
}

export async function writeToolSample(destPath: string) {
  const template = await readWeatherTemplateFile('tools/index.ts');
  const formattedContent = await formatTypescript(template);
  await fs.writeFile(destPath, formattedContent);
}

export async function writeCodeSampleForComponents(
  llmprovider: LLMProvider,
  component: Components,
  destPath: string,
  importComponents: Components[],
) {
  switch (component) {
    case 'agents':
      await writeAgentSample(llmprovider, destPath, importComponents.includes('tools'));
      // Also write scorers alongside agents
      const scorersPath = path.join(path.dirname(path.dirname(destPath)), 'scorers', 'index.ts');
      await fsExtra.ensureDir(path.dirname(scorersPath));
      await writeScorersSample(scorersPath);
      return;
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

export const writeScorersSample = async (destPath: string) => {
  const template = await readWeatherTemplateFile('scorers/index.ts');
  const formattedContent = await formatTypescript(template);
  await fs.writeFile(destPath, formattedContent);
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
    if (!addExample) {
      await fs.writeFile(
        destPath,
        `\nimport { Mastra } from '@mastra/core';\n\nexport const mastra = new Mastra()\n        `,
      );
      return;
    }

    // Start from the weather-agent template index and transform
    let idx = await readWeatherTemplateFile('index.ts');

    // Point imports to specific files we generate
    idx = idx.replace(/from\s*['"]\.\/agents['"]/g, "from './agents/weather-agent'");
    idx = idx.replace(/from\s*['"]\.\/workflows['"]/g, "from './workflows/weather-workflow'");

    if (!addAgent) {
      idx = idx.replace(/\n?import\s*\{\s*weatherAgent\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '\n');
      idx = idx.replace(/\n\s*agents:\s*\{\s*weatherAgent\s*\}\s*,?/g, '\n');
      // Keep scorers only if we have an agent; otherwise remove import & property

      idx = idx.replace(/\n?import\s*\{\s*scorers\s*\}\s*from\s*['"]\.\/scorers['"];?\n?/g, '\n');
      idx = idx.replace(/\n\s*scorers\s*,?/g, '\n');
    }

    if (!addWorkflow) {
      idx = idx.replace(/\n?import\s*\{\s*weatherWorkflow\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '\n');
      idx = idx.replace(/\n\s*workflows:\s*\{\s*weatherWorkflow\s*\}\s*,?/g, '\n');
    }

    const formattedIndex = await formatTypescript(idx);
    await fs.writeFile(destPath, formattedIndex);
  } catch (err) {
    throw err;
  }
};

export const checkInitialization = async (dirPath: string) => {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
};

export const checkAndInstallCoreDeps = async (addExample: boolean) => {
  const depService = new DepsService();
  const needsCore = (await depService.checkDependencies(['@mastra/core'])) !== `ok`;
  const needsZod = (await depService.checkDependencies(['zod'])) !== `ok`;

  if (needsCore) {
    await installCoreDeps('@mastra/core');
  }

  if (needsZod) {
    // TODO: Once the switch to AI SDK v5 is complete, this needs to be updated
    await installCoreDeps('zod', '^3');
  }

  if (addExample) {
    const needsLibsql = (await depService.checkDependencies(['@mastra/libsql'])) !== `ok`;

    if (needsLibsql) {
      await installCoreDeps('@mastra/libsql');
    }
  }
};

const spinner = yoctoSpinner({ text: 'Installing Mastra core dependencies\n' });
export async function installCoreDeps(pkg: string, version = 'latest') {
  try {
    const confirm = await p.confirm({
      message: `You do not have the ${pkg} package installed. Would you like to install it?`,
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

    await depsService.installPackages([`${pkg}@${version}`]);
    spinner.success(`${pkg} installed successfully`);
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
    case 'google':
      key = 'GOOGLE_GENERATIVE_AI_API_KEY';
      return key;
    case 'cerebras':
      key = 'CEREBRAS_API_KEY';
      return key;
    case 'mistral':
      key = 'MISTRAL_API_KEY';
      return key;
    default:
      return key;
  }
};

export const writeAPIKey = async ({ provider, apiKey }: { provider: LLMProvider; apiKey?: string }) => {
  /**
   * If people skip entering an API key (because they e.g. have it in their environment already), we write to .env.example instead of .env so that they can immediately run Mastra without having to delete an .env file with an invalid key.
   */
  const envFileName = apiKey ? '.env' : '.env.example';

  const key = await getAPIKey(provider);
  const escapedKey = shellQuote.quote([key]);
  const escapedApiKey = shellQuote.quote([apiKey ? apiKey : 'your-api-key']);
  await exec(`echo ${escapedKey}=${escapedApiKey} >> ${envFileName}`);
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
  importComponents: Components[],
) => {
  const destPath = dirPath + `/${component}/weather-${component.slice(0, -1)}.ts`;

  try {
    await writeCodeSampleForComponents(llmProvider, component, destPath, importComponents);
  } catch (err) {
    throw err;
  }
};

const LLM_PROVIDERS: { value: LLMProvider; label: string; hint?: string }[] = [
  { value: 'openai', label: 'OpenAI', hint: 'recommended' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
  { value: 'google', label: 'Google' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'mistral', label: 'Mistral' },
];

interface InteractivePromptArgs {
  options?: {
    showBanner?: boolean;
  };
  skip?: {
    llmProvider?: boolean;
    llmApiKey?: boolean;
  };
}

export const interactivePrompt = async (args: InteractivePromptArgs = {}) => {
  const { skip = {}, options: { showBanner = true } = {} } = args;

  if (showBanner) {
    p.intro(color.inverse(' Mastra Init '));
  }
  const mastraProject = await p.group(
    {
      directory: () =>
        p.text({
          message: 'Where should we create the Mastra files? (default: src/)',
          placeholder: 'src/',
          defaultValue: 'src/',
        }),
      llmProvider: () =>
        skip?.llmProvider
          ? undefined
          : p.select({
              message: 'Select a default provider:',
              options: LLM_PROVIDERS,
            }),
      llmApiKey: async ({ results: { llmProvider } }) => {
        if (skip?.llmApiKey) return undefined;

        const llmName = LLM_PROVIDERS.find(p => p.value === llmProvider)?.label || 'provider';
        const keyChoice = await p.select({
          message: `Enter your ${llmName} API key?`,
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
            validate: value => {
              if (value.length === 0) return 'API key cannot be empty';
            },
          });
        }
        return undefined;
      },
      configureEditorWithDocsMCP: async () => {
        const windsurfIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`windsurf`);
        const cursorIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`cursor`);
        const vscodeIsAlreadyInstalled = await globalMCPIsAlreadyInstalled(`vscode`);

        const editor = await p.select({
          message: `Make your IDE into a Mastra expert? (Installs Mastra's MCP server)`,
          options: [
            { value: 'skip', label: 'Skip for now', hint: 'default' },
            {
              value: 'cursor',
              label: 'Cursor (project only)',
              hint: cursorIsAlreadyInstalled ? `Already installed globally` : undefined,
            },
            {
              value: 'cursor-global',
              label: 'Cursor (global, all projects)',
              hint: cursorIsAlreadyInstalled ? `Already installed` : undefined,
            },
            {
              value: 'windsurf',
              label: 'Windsurf',
              hint: windsurfIsAlreadyInstalled ? `Already installed` : undefined,
            },
            {
              value: 'vscode',
              label: 'VSCode',
              hint: vscodeIsAlreadyInstalled ? `Already installed` : undefined,
            },
          ],
        });

        if (editor === `skip`) return undefined;
        if (editor === `windsurf` && windsurfIsAlreadyInstalled) {
          p.log.message(`\nWindsurf is already installed, skipping.`);
          return undefined;
        }
        if (editor === `vscode` && vscodeIsAlreadyInstalled) {
          p.log.message(`\nVSCode is already installed, skipping.`);
          return undefined;
        }

        if (editor === `cursor`) {
          p.log.message(
            `\nNote: you will need to go into Cursor Settings -> MCP Settings and manually enable the installed Mastra MCP server.\n`,
          );
        }

        if (editor === `cursor-global`) {
          const confirm = await p.select({
            message: `Global install will add/update ${cursorGlobalMCPConfigPath} and make the Mastra docs MCP server available in all your Cursor projects. Continue?`,
            options: [
              { value: 'yes', label: 'Yes, I understand' },
              { value: 'skip', label: 'No, skip for now' },
            ],
          });
          if (confirm !== `yes`) {
            return undefined;
          }
        }

        if (editor === `windsurf`) {
          const confirm = await p.select({
            message: `Windsurf only supports a global MCP config (at ${windsurfGlobalMCPConfigPath}) is it ok to add/update that global config?\nThis means the Mastra docs MCP server will be available in all your Windsurf projects.`,
            options: [
              { value: 'yes', label: 'Yes, I understand' },
              { value: 'skip', label: 'No, skip for now' },
            ],
          });
          if (confirm !== `yes`) {
            return undefined;
          }
        }

        return editor;
      },
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );

  return mastraProject;
};

/**
 * Check if the current directory has a package.json file. If not, we should alert the user to create one or run "mastra create" to create a new project. The package.json file is required to install dependencies in the next steps.
 */
export const checkForPkgJson = async () => {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  try {
    await fs.access(pkgJsonPath);

    // Do nothing
  } catch {
    p.log.error(
      'No package.json file found in the current directory. Please run "npm init -y" to create one, or run "npx create-mastra@latest" to create a new Mastra project.',
    );

    process.exit(1);
  }
};

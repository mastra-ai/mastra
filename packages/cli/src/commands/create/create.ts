import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import type { PosthogAnalytics } from '../../analytics/index';
import { getAnalytics } from '../../analytics/index';
import { cloneTemplate, installDependencies } from '../../utils/clone-template';
import { findTemplateByName, loadTemplates, selectTemplate } from '../../utils/template-utils';
import type { Template } from '../../utils/template-utils';
import { init } from '../init/init';
import type { LLMProvider } from '../init/utils';
import { getPackageManager } from '../utils.js';

import {
  CREATE_LLM_PROVIDERS,
  configureCreateCommand,
  getCreateMode,
  normalizeCreateCommandOptions,
  parseCreateLLMProvider,
  parseCreateTimeout,
  selectMatchingDistTag,
  validateCreateOptionConflicts,
  validateProjectName,
} from './command';
import type { CreateCommandOptions, CreateLLMProvider, CreateMode, NormalizedCreateOptions } from './command';
import { createMastraProject } from './utils';

export {
  CREATE_LLM_PROVIDERS,
  configureCreateCommand,
  getCreateMode,
  normalizeCreateCommandOptions,
  parseCreateLLMProvider,
  parseCreateTimeout,
  selectMatchingDistTag,
  validateCreateOptionConflicts,
  validateProjectName,
};
export type { CreateCommandOptions, CreateLLMProvider, CreateMode, NormalizedCreateOptions };

export class CreateCancelledError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'CreateCancelledError';
  }
}

export function isCreateCancelledError(error: unknown): error is CreateCancelledError {
  return error instanceof CreateCancelledError;
}

export interface CreateOptions {
  projectName?: string;
  yes?: boolean;
  empty?: boolean;
  llmProvider?: CreateLLMProvider;
  llmApiKey?: string;
  skills?: boolean;
  git?: boolean;
  template?: string | boolean;
  timeout?: number;
  analytics?: PosthogAnalytics;
  resolveVersionTag?: () => Promise<string | undefined>;
}

function cancelCreate(): never {
  p.cancel('Operation cancelled');
  throw new CreateCancelledError();
}

async function runCreatePrompt<T>(prompt: (signal: AbortSignal) => Promise<T | symbol>): Promise<T> {
  const controller = new AbortController();
  let rejectCancellation: (error: CreateCancelledError) => void = () => {};
  let cancellationAnnounced = false;
  const announceCancellation = () => {
    if (cancellationAnnounced) return;
    cancellationAnnounced = true;
    p.cancel('Operation cancelled');
  };
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const abort = () => {
    controller.abort();
    announceCancellation();
    rejectCancellation(new CreateCancelledError());
  };
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);

  try {
    const value = await Promise.race([prompt(controller.signal), cancellation]);
    if (p.isCancel(value)) {
      announceCancellation();
      throw new CreateCancelledError();
    }
    return value;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

async function promptForProjectName(): Promise<string> {
  return runCreatePrompt(signal =>
    p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-app',
      signal,
    }),
  );
}

async function promptForProvider(): Promise<CreateLLMProvider> {
  return runCreatePrompt(signal =>
    p.select({
      message: 'Select a default provider:',
      options: [...CREATE_LLM_PROVIDERS],
      signal,
    }),
  );
}

async function promptForApiKey(provider: CreateLLMProvider): Promise<string | undefined> {
  const providerName = CREATE_LLM_PROVIDERS.find(option => option.value === provider)?.label ?? provider;
  const choice = await runCreatePrompt(signal =>
    p.select({
      message: `Enter your ${providerName} API key?`,
      options: [
        { value: 'skip', label: 'Skip for now', hint: 'default' },
        { value: 'enter', label: 'Enter API key' },
      ],
      initialValue: 'skip',
      showInstructions: false,
      signal,
    }),
  );

  if (choice === 'skip') return undefined;

  return runCreatePrompt(signal =>
    p.password({
      message: 'Enter your API key:',
      mask: '*',
      clearOnError: true,
      validate: value => {
        if (!value) return 'API key cannot be empty';
      },
      signal,
    }),
  );
}

function normalizeDirectCreateOptions(args: CreateOptions): NormalizedCreateOptions {
  return {
    projectName: args.projectName,
    yes: args.yes ?? false,
    empty: args.empty ?? false,
    llmProvider: args.llmProvider,
    llmApiKey: args.llmApiKey,
    skills: args.skills ?? true,
    git: args.git ?? true,
    template: args.template,
    timeout: args.timeout ?? 60_000,
  };
}

export async function runCreateCommand(
  projectName: string | undefined,
  options: CreateCommandOptions,
  dependencies: Pick<CreateOptions, 'analytics' | 'resolveVersionTag'> = {},
): Promise<void> {
  const normalized = normalizeCreateCommandOptions(projectName, options);
  await create({ ...normalized, ...dependencies });
}

export const create = async (args: CreateOptions): Promise<void> => {
  const options = normalizeDirectCreateOptions(args);
  const mode = validateCreateOptionConflicts(options);

  const rawProjectName = options.projectName ?? (await promptForProjectName());
  const projectName = validateProjectName(rawProjectName);
  const projectPath = path.resolve(process.cwd(), projectName);

  if (fsSync.existsSync(projectPath)) {
    throw new Error(`A file or directory named "${projectName}" already exists. Please choose a different name.`);
  }

  let llmProvider = options.llmProvider;
  let llmApiKey = options.llmApiKey;
  let providerSelectionMethod: 'cli_args' | 'interactive' | 'default' | undefined;

  if (mode === 'managed') {
    if (llmProvider) {
      providerSelectionMethod = 'cli_args';
    } else if (options.yes) {
      llmProvider = 'openai';
      providerSelectionMethod = 'default';
    } else {
      llmProvider = await promptForProvider();
      providerSelectionMethod = 'interactive';
    }

    if (llmApiKey === undefined && !options.yes) {
      llmApiKey = await promptForApiKey(llmProvider);
    }
  }

  const analytics = args.analytics ?? getAnalytics();
  analytics?.trackEvent('cli_create_mode_selected', {
    mode,
    template_slug: typeof options.template === 'string' ? options.template : undefined,
    skills: options.skills,
    git: options.git,
  });
  if (llmProvider) {
    analytics?.trackEvent('cli_model_provider_selected', {
      provider: llmProvider,
      selection_method: providerSelectionMethod,
    });
  }

  const createVersionTag = mode === 'template' ? undefined : ((await args.resolveVersionTag?.()) ?? 'latest');

  if (mode === 'managed') {
    await createFromTemplate({
      projectName,
      template: 'agent-harness',
      timeout: options.timeout,
      injectedAnalytics: analytics ?? undefined,
      llmProvider,
      createVersionTag,
    });
    return;
  }

  if (mode === 'template') {
    await createFromTemplate({
      projectName,
      template: options.template,
      timeout: options.timeout,
      injectedAnalytics: analytics ?? undefined,
    });
    return;
  }

  await createEmptyWithLegacyScaffold({
    projectName,
    timeout: options.timeout,
    createVersionTag: createVersionTag ?? 'latest',
  });
};

async function createEmptyWithLegacyScaffold(args: {
  projectName: string;
  timeout: number;
  createVersionTag: string;
}): Promise<void> {
  const { projectName } = await createMastraProject({
    projectName: args.projectName,
    createVersionTag: args.createVersionTag,
    timeout: args.timeout,
    needsInteractive: false,
  });

  await init({
    directory: 'src/',
    components: [],
    addExample: false,
    versionTag: args.createVersionTag,
  });
  postCreate({ projectName });
}

const postCreate = ({ projectName }: { projectName: string }) => {
  const packageManager = getPackageManager();
  p.outro(`
   ${color.green('To start your project:')}

    ${color.cyan('cd')} ${projectName}
    ${color.cyan(`${packageManager} run dev`)}
  `);
};

function isGitHubUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'github.com' && parsedUrl.pathname.split('/').length >= 3;
  } catch {
    return false;
  }
}

async function validateGitHubProject(githubUrl: string): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const urlParts = new URL(githubUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1]?.replace('.git', '');

    if (!owner || !repo) throw new Error('Invalid GitHub URL format');

    let packageJsonContent: string | null = null;
    let indexContent: string | null = null;

    for (const branch of ['main', 'master']) {
      try {
        const packageJsonResponse = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
        );
        if (!packageJsonResponse.ok) continue;

        packageJsonContent = await packageJsonResponse.text();
        const indexResponse = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/src/mastra/index.ts`,
        );
        if (indexResponse.ok) indexContent = await indexResponse.text();
        break;
      } catch {
        // Try the next branch.
      }
    }

    if (!packageJsonContent) {
      errors.push('Could not fetch package.json from repository');
      return { isValid: false, errors };
    }

    try {
      const packageJson = JSON.parse(packageJsonContent);
      const hasMastraCore =
        packageJson.dependencies?.['@mastra/core'] ||
        packageJson.devDependencies?.['@mastra/core'] ||
        packageJson.peerDependencies?.['@mastra/core'];
      if (!hasMastraCore) errors.push('Missing @mastra/core dependency in package.json');
    } catch {
      errors.push('Invalid package.json format');
    }

    if (!indexContent) {
      errors.push('Missing src/mastra/index.ts file');
    } else if (
      !indexContent.includes('export') ||
      (!indexContent.includes('new Mastra') && !indexContent.includes('Mastra('))
    ) {
      errors.push('src/mastra/index.ts does not export a Mastra instance');
    }

    return { isValid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Failed to validate GitHub repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors };
  }
}

function createFromGitHubUrl(url: string): Template {
  const urlParts = new URL(url).pathname.split('/').filter(Boolean);
  const owner = urlParts[0] || 'unknown';
  const repo = urlParts[1] || 'unknown';

  return {
    githubUrl: url,
    title: `${owner}/${repo}`,
    slug: repo,
    agents: [],
    mcp: [],
    tools: [],
    networks: [],
    workflows: [],
  };
}

async function createFromTemplate(args: {
  projectName: string;
  template?: string | boolean;
  timeout: number;
  injectedAnalytics?: PosthogAnalytics;
  llmProvider?: CreateLLMProvider;
  createVersionTag?: string;
}) {
  let selectedTemplate: Template | undefined;

  if (args.template === true) {
    const templates = await loadTemplates();
    const selected = await runCreatePrompt(signal => selectTemplate(templates, { signal }));
    if (!selected) cancelCreate();
    selectedTemplate = selected;
  } else if (typeof args.template === 'string') {
    if (isGitHubUrl(args.template)) {
      const spinner = p.spinner();
      spinner.start('Validating GitHub repository...');
      const validation = await validateGitHubProject(args.template);
      if (!validation.isValid) {
        spinner.stop('Validation failed');
        p.log.error('This does not appear to be a valid Mastra project:');
        validation.errors.forEach(error => p.log.error(`  - ${error}`));
        throw new Error('Invalid Mastra project');
      }
      spinner.stop('Valid Mastra project ✓');
      selectedTemplate = createFromGitHubUrl(args.template);
    } else {
      const templates = await loadTemplates();
      const found = findTemplateByName(templates, args.template);
      if (!found) {
        p.log.error(`Template "${args.template}" not found. Available templates:`);
        templates.forEach(template =>
          p.log.info(`  - ${template.title} (use: ${template.slug.replace('template-', '')})`),
        );
        throw new Error(`Template "${args.template}" not found`);
      }
      selectedTemplate = found;
    }
  }

  if (!selectedTemplate) throw new Error('No template selected');

  let projectPath: string | null = null;
  try {
    const analytics = args.injectedAnalytics ?? getAnalytics();
    analytics?.trackEvent('cli_template_used', {
      template_slug: selectedTemplate.slug,
      template_title: selectedTemplate.title,
    });

    const isMastraTemplate = selectedTemplate.githubUrl.includes('github.com/mastra-ai/');
    const branch = args.createVersionTag === 'beta' && isMastraTemplate ? 'beta' : undefined;

    projectPath = await cloneTemplate({
      template: selectedTemplate,
      projectName: args.projectName,
      branch,
      llmProvider: args.llmProvider as LLMProvider | undefined,
    });
    await installDependencies(projectPath);

    p.note(`
      ${color.green('Mastra template installed!')}

      Add the necessary environment
      variables in your ${color.cyan('.env')} file
      `);
    postCreate({ projectName: args.projectName });
  } catch (error) {
    if (projectPath && fsSync.existsSync(projectPath)) {
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(
          `Warning: Failed to clean up project directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
        );
      }
    }
    p.log.error(`Failed to create project from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

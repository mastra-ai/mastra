import fsSync from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import type { PosthogAnalytics } from '../../analytics/index';
import { getAnalytics } from '../../analytics/index';
import { cloneTemplate, installDependencies } from '../../utils/clone-template';
import { findTemplateByName, loadTemplates, selectTemplate } from '../../utils/template-utils';
import type { Template } from '../../utils/template-utils';
import { installMastraSkills } from '../init/skills-install';
import { getPackageManager, gitInit, isGitInitialized } from '../utils.js';
import { detectCodingAgentSkills } from './coding-agents';
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
import { adaptDefaultTemplate } from './provider-adapter';
import {
  cleanupOwnedStagingDirectory,
  createOwnedStagingDirectory,
  publishStagedProject,
  writeEmptyScaffold,
} from './utils';

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

const DEFAULT_TEMPLATE: Template = {
  githubUrl: 'https://github.com/mastra-ai/template-agent-harness',
  title: 'Agent Harness',
  slug: 'template-agent-harness',
  agents: ['agent'],
  mcp: [],
  tools: ['web-fetch'],
  networks: [],
  workflows: [],
};

export class CreateCancelledError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'CreateCancelledError';
  }
}

export function isCreateCancelledError(error: unknown): error is CreateCancelledError {
  return error instanceof CreateCancelledError;
}

export function getCreateCommandAnalyticsArgs(args: CreateCommandOptions) {
  return {
    mode: args.empty ? 'empty' : args.template !== undefined ? 'template' : 'managed',
    skills: args.skills,
    git: args.git,
  };
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

  try {
    const value = await Promise.race([prompt(controller.signal), cancellation]);
    if (p.isCancel(value)) {
      announceCancellation();
      throw new CreateCancelledError();
    }
    return value;
  } finally {
    process.removeListener('SIGINT', abort);
  }
}

async function promptForProjectName(): Promise<string> {
  return runCreatePrompt(signal =>
    p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-app',
      signal,
      validate: value => {
        if (!value || value.length === 0) return `Project name can't be empty`;
        if (fsSync.existsSync(value)) {
          return `A directory named "${value}" already exists. Please choose a different name.`;
        }
      },
    }),
  );
}

async function promptForProvider(): Promise<CreateLLMProvider> {
  return runCreatePrompt(signal =>
    p.select({
      message: 'Select a default model provider:',
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
        if (!value) return `API key can't be empty`;
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
  const invocationCwd = process.cwd();

  const rawProjectName = options.projectName ?? (await promptForProjectName());
  const projectName = validateProjectName(rawProjectName);
  const targetPath = path.resolve(invocationCwd, projectName);

  if (fsSync.existsSync(targetPath)) {
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

  const selectedTemplate = mode === 'empty' ? undefined : await resolveTemplate(mode, options.template);
  const analytics = args.analytics ?? getAnalytics();
  analytics?.trackEvent('cli_create_mode_selected', {
    mode,
    template_slug: mode === 'template' ? selectedTemplate?.slug : undefined,
    skills: options.skills,
    git: options.git,
  });
  if (llmProvider) {
    analytics?.trackEvent('cli_model_provider_selected', {
      provider: llmProvider,
      selection_method: providerSelectionMethod,
    });
  }
  if (selectedTemplate) {
    analytics?.trackEvent('cli_template_used', {
      template_slug: selectedTemplate.slug,
    });
  }

  const versionTag = mode === 'template' ? undefined : ((await args.resolveVersionTag?.()) ?? 'latest');
  const packageManager = getPackageManager();
  const invocationIsGitWorktree = await isGitInitialized({ cwd: invocationCwd });
  const staging = await createOwnedStagingDirectory(invocationCwd, projectName);
  let selectedApiKeyEnv: string | undefined;

  try {
    if (mode === 'empty') {
      await writeEmptyScaffold({
        projectPath: staging.projectPath,
        projectName,
        versionTag: versionTag ?? 'latest',
        packageManager,
      });
    } else {
      const isManaged = mode === 'managed';
      const branch = isManaged && versionTag === 'beta' ? 'beta' : undefined;
      await cloneTemplate({
        template: selectedTemplate!,
        projectName,
        targetDir: staging.rootPath,
        branch,
      });

      if (isManaged) {
        const providerConfig = await adaptDefaultTemplate({
          projectPath: staging.projectPath,
          provider: llmProvider!,
          apiKey: llmApiKey,
          versionTag: versionTag ?? 'latest',
        });
        selectedApiKeyEnv = providerConfig.apiKeyEnv;
      }
    }

    await installDependencies(staging.projectPath, packageManager, options.timeout);
    await publishStagedProject({ projectPath: staging.projectPath, targetPath, projectName });
  } finally {
    if (process.cwd() !== invocationCwd) {
      process.chdir(invocationCwd);
    }
    try {
      await cleanupOwnedStagingDirectory(staging.rootPath);
    } catch (cleanupError) {
      console.error(
        `Warning: Failed to clean up staging directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
      );
    }
  }

  const postSetup = await runPostCreateSetup({
    projectPath: targetPath,
    installSkills: options.skills,
    initializeGit: options.git,
    invocationIsGitWorktree,
  });
  analytics?.trackEvent('cli_create_post_setup', {
    skills_agents: postSetup.skillsAgents,
    skills_outcome: postSetup.skillsOutcome,
    git_outcome: postSetup.gitOutcome,
  });
  p.note(formatPostCreateSetup(postSetup), postSetup.hasFailure ? 'Setup warnings' : 'Project setup');

  if (mode === 'managed') {
    p.note(
      llmApiKey
        ? `${color.green('Success!')}\n\nYour ${selectedApiKeyEnv} value was written to ${color.cyan('.env')}.`
        : `${color.green('Success!')}\n\nSet ${selectedApiKeyEnv} in your ${color.cyan('.env')} file before starting.`,
    );
  } else if (mode === 'template') {
    p.note(`${color.green('Success!')}\n\nAdd any required environment variables in your ${color.cyan('.env')} file.`);
  }

  postCreate({ projectName, packageManager });
};

interface PostCreateSetupResult {
  skillsAgents: string[];
  skillsOutcome: 'installed' | 'failed' | 'opted_out';
  gitOutcome: 'initialized' | 'failed' | 'opted_out' | 'parent_worktree' | 'target_worktree';
  hasFailure: boolean;
}

async function runPostCreateSetup({
  projectPath,
  installSkills,
  initializeGit,
  invocationIsGitWorktree,
}: {
  projectPath: string;
  installSkills: boolean;
  initializeGit: boolean;
  invocationIsGitWorktree: boolean;
}): Promise<PostCreateSetupResult> {
  let skillsAgents: string[] = [];
  let skillsOutcome: PostCreateSetupResult['skillsOutcome'] = 'opted_out';

  if (installSkills) {
    try {
      skillsAgents = await detectCodingAgentSkills();
      const result = await installMastraSkills({ directory: projectPath, agents: skillsAgents });
      skillsOutcome = result.success ? 'installed' : 'failed';
    } catch {
      skillsOutcome = 'failed';
    }
  }

  let gitOutcome: PostCreateSetupResult['gitOutcome'];
  if (!initializeGit) {
    gitOutcome = 'opted_out';
  } else if (invocationIsGitWorktree) {
    gitOutcome = 'parent_worktree';
  } else if (await isGitInitialized({ cwd: projectPath })) {
    gitOutcome = 'target_worktree';
  } else {
    try {
      await gitInit({ cwd: projectPath });
      gitOutcome = 'initialized';
    } catch {
      gitOutcome = 'failed';
    }
  }

  return {
    skillsAgents,
    skillsOutcome,
    gitOutcome,
    hasFailure: skillsOutcome === 'failed' || gitOutcome === 'failed',
  };
}

function formatPostCreateSetup(result: PostCreateSetupResult): string {
  const agents = result.skillsAgents.join(', ');
  const skillsSummary =
    result.skillsOutcome === 'opted_out'
      ? 'Skills: skipped (--no-skills)'
      : result.skillsOutcome === 'installed'
        ? `Skills: installed for ${agents}`
        : `Skills: installation failed${agents ? ` for ${agents}` : ''}`;

  const gitSummaries: Record<PostCreateSetupResult['gitOutcome'], string> = {
    initialized: 'Git: initialized with an initial commit',
    failed: 'Git: initialization failed',
    opted_out: 'Git: skipped (--no-git)',
    parent_worktree: 'Git: skipped because the project is inside an existing worktree',
    target_worktree: 'Git: skipped because the project already contains git metadata',
  };

  return `${skillsSummary}\n${gitSummaries[result.gitOutcome]}`;
}

const postCreate = ({ projectName, packageManager }: { projectName: string; packageManager: string }) => {
  p.outro(`
   ${color.green('To start your project:')}

    ${color.cyan('cd')} ${projectName}
    ${color.cyan(`${packageManager} run dev`)}
  `);
};

function parseGitHubRepositoryUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value.startsWith('github.com/') ? `https://${value}` : value);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'github.com' ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      pathParts.length !== 2
    ) {
      return undefined;
    }

    const [owner, repoPart] = pathParts;
    const repo = repoPart?.replace(/\.git$/, '');
    if (!owner || !repo) return undefined;
    return `https://github.com/${owner}/${repo}`;
  } catch {
    return undefined;
  }
}

function looksLikeGitHubUrl(value: string): boolean {
  try {
    return new URL(value.startsWith('github.com/') ? `https://${value}` : value).hostname === 'github.com';
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

async function resolveTemplate(mode: Exclude<CreateMode, 'empty'>, template?: string | boolean): Promise<Template> {
  if (mode === 'managed') return DEFAULT_TEMPLATE;

  if (template === true) {
    const templates = await loadTemplates();
    const selected = await runCreatePrompt(signal => selectTemplate(templates, { signal }));
    if (!selected) cancelCreate();
    return selected;
  }

  if (typeof template !== 'string') {
    throw new Error('No template selected');
  }

  const githubUrl = parseGitHubRepositoryUrl(template);
  if (githubUrl) {
    const spinner = p.spinner();
    spinner.start('Validating GitHub repository...');
    const validation = await validateGitHubProject(githubUrl);
    if (!validation.isValid) {
      spinner.stop('Validation failed');
      p.log.error('This does not appear to be a valid Mastra project:');
      validation.errors.forEach(error => p.log.error(`  - ${error}`));
      throw new Error('Invalid Mastra project');
    }
    spinner.stop('Valid Mastra project ✓');
    return createFromGitHubUrl(githubUrl);
  }
  if (looksLikeGitHubUrl(template)) {
    throw new Error('Invalid GitHub repository URL. Use https://github.com/<owner>/<repository>.');
  }

  const templates = await loadTemplates();
  const found = findTemplateByName(templates, template);
  if (!found) {
    p.log.error(`Template "${template}" not found. Available templates:`);
    templates.forEach(availableTemplate =>
      p.log.info(`  - ${availableTemplate.title} (use: ${availableTemplate.slug.replace('template-', '')})`),
    );
    throw new Error(`Template "${template}" not found`);
  }
  return found;
}

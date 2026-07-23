import path from 'node:path';
import type { Command } from 'commander';
import { InvalidArgumentError } from 'commander';

export const CREATE_LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Gemini' },
  { value: 'xai', label: 'xAI' },
] as const;

export type CreateLLMProvider = (typeof CREATE_LLM_PROVIDERS)[number]['value'];
export type CreateMode = 'managed' | 'template' | 'empty';

export interface CreateCommandOptions {
  empty?: boolean;
  llm?: CreateLLMProvider;
  llmApiKey?: string;
  skills: boolean;
  git: boolean;
  template?: string | boolean;
  timeout: number;
}

export interface NormalizedCreateOptions {
  projectName?: string;
  empty: boolean;
  llmProvider?: CreateLLMProvider;
  llmApiKey?: string;
  skills: boolean;
  git: boolean;
  template?: string | boolean;
  timeout: number;
}

export function parseCreateLLMProvider(value: string): CreateLLMProvider {
  if (!CREATE_LLM_PROVIDERS.some(provider => provider.value === value)) {
    throw new InvalidArgumentError(
      `Choose a valid provider: ${CREATE_LLM_PROVIDERS.map(provider => provider.value).join(', ')}`,
    );
  }

  return value as CreateLLMProvider;
}

export function parseCreateTimeout(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError('Timeout must be a positive integer');
  }

  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new InvalidArgumentError('Timeout must be a positive integer');
  }

  return timeout;
}

export function configureCreateCommand(command: Command) {
  return command
    .description('Create a new Mastra project')
    .argument('[project-name]', 'Directory name of the project')
    .option('--empty', 'Create an empty project')
    .option(
      '-l, --llm <provider>',
      `Model provider (${CREATE_LLM_PROVIDERS.map(provider => provider.value).join(', ')})`,
      parseCreateLLMProvider,
    )
    .option('-k, --llm-api-key <key>', 'API key for the model provider')
    .option('--no-skills', 'Do not install Mastra skills')
    .option('--no-git', 'Do not initialize a git repository')
    .option(
      '-t, --template [template]',
      'Create from a template slug or public GitHub URL, or select interactively when omitted',
    )
    .option('--timeout <milliseconds>', 'Package installation timeout in milliseconds', parseCreateTimeout, 60_000);
}

export function normalizeCreateCommandOptions(
  projectName: string | undefined,
  options: CreateCommandOptions,
): NormalizedCreateOptions {
  return {
    projectName,
    empty: options.empty ?? false,
    llmProvider: options.llm,
    llmApiKey: options.llmApiKey,
    skills: options.skills,
    git: options.git,
    template: options.template,
    timeout: options.timeout,
  };
}

export function getCreateMode(options: Pick<NormalizedCreateOptions, 'empty' | 'template'>): CreateMode {
  if (options.empty) return 'empty';
  if (options.template !== undefined) return 'template';
  return 'managed';
}

export function validateCreateOptionConflicts(options: NormalizedCreateOptions): CreateMode {
  if (options.empty && options.template !== undefined) {
    throw new Error(`The --empty and --template options can't be used together`);
  }

  const mode = getCreateMode(options);
  if (mode !== 'managed' && options.llmProvider !== undefined) {
    throw new Error('The --llm option can only be used with the default template');
  }
  if (mode !== 'managed' && options.llmApiKey !== undefined) {
    throw new Error('The --llm-api-key option can only be used with the default template');
  }

  return mode;
}

const WINDOWS_RESERVED_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function validateProjectName(value: string): string {
  const projectName = value.trim();

  if (
    projectName.length < 1 ||
    projectName.length > 214 ||
    path.isAbsolute(projectName) ||
    projectName.includes('/') ||
    projectName.includes('\\') ||
    projectName === '.' ||
    projectName === '..' ||
    projectName.endsWith('.') ||
    !PROJECT_NAME_PATTERN.test(projectName) ||
    WINDOWS_RESERVED_BASENAME.test(projectName)
  ) {
    throw new Error(
      'Project name must be 1-214 lowercase characters, start with a letter or number, and contain only letters, numbers, dots, hyphens, or underscores',
    );
  }

  return projectName;
}

const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;

function getPrereleaseChannel(version: string): string | undefined {
  const separator = version.indexOf('-');
  if (separator === -1) return undefined;
  return version
    .slice(separator + 1)
    .split('.')
    .find(identifier => !NUMERIC_IDENTIFIER_PATTERN.test(identifier));
}

export function selectMatchingDistTag(version: string, output: string): string | undefined {
  const matchingTags = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const separator = line.indexOf(':');
      if (separator === -1) return [];
      const tag = line.slice(0, separator).trim();
      const taggedVersion = line.slice(separator + 1).trim();
      return taggedVersion === version && tag ? [tag] : [];
    });

  if (matchingTags.length === 0) return undefined;

  const prereleaseChannel = getPrereleaseChannel(version);
  const matchingPrereleaseTag = prereleaseChannel
    ? matchingTags.find(tag => prereleaseChannel === tag || prereleaseChannel.startsWith(`${tag}-`))
    : undefined;
  if (matchingPrereleaseTag) return matchingPrereleaseTag;
  if (matchingTags.includes('latest')) return 'latest';
  if (matchingTags.includes('beta')) return 'beta';
  return matchingTags.sort((a, b) => a.localeCompare(b))[0];
}

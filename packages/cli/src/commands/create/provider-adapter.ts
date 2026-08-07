import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { PackageManager } from '../../utils/package-manager';
import type { CreateLLMProvider } from './command';
import { PNPM_WORKSPACE } from './utils';
import type { ResolvedMastraVersions } from './version-resolver';
import { resolveMastraPackageVersions } from './version-resolver';

export interface ManagedProviderConfig {
  displayName: string;
  primaryModel?: string;
  observationalModel?: string;
  apiKeyEnv: string;
}

export const MANAGED_PROVIDER_CONFIGS: Record<CreateLLMProvider, ManagedProviderConfig> = {
  openai: {
    displayName: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    displayName: 'Anthropic',
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  google: {
    displayName: 'Google Gemini',
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
    apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  xai: {
    displayName: 'xAI',
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
    apiKeyEnv: 'XAI_API_KEY',
  },
};

const OPENAI_API_KEY = 'OPENAI_API_KEY';
const PRIMARY_OPENAI_MODEL = /(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])(?=\s*,?\s*\n\s*defaultOptions\s*:)/g;
const OBSERVATIONAL_OPENAI_MODEL = /(observationalMemory\s*:\s*\{[^{}]*?\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g;

interface ManagedTemplateAdaptationResult extends ManagedProviderConfig {
  apiKeyWritten: boolean;
  adaptationFailed: boolean;
}

interface TransformResult {
  applied: boolean;
  content: string;
}

function findMatches(content: string, pattern: RegExp): RegExpMatchArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...content.matchAll(new RegExp(pattern.source, flags))];
}

function replaceSingleMatch(
  content: string,
  pattern: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
): TransformResult {
  if (findMatches(content, pattern).length !== 1) return { applied: false, content };
  if (typeof replacement === 'string') return { applied: true, content: content.replace(pattern, replacement) };
  return { applied: true, content: content.replace(pattern, replacement) };
}

function getDependencyMap(manifest: Record<string, unknown>, section: 'dependencies' | 'devDependencies') {
  const value = manifest[section];
  if (value === undefined && section === 'devDependencies') return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function collectMastraPackages(manifestSource: string): string[] {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestSource) as Record<string, unknown>;
  } catch {
    return [];
  }
  const names = new Set<string>();
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const deps = manifest[section];
    if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
      for (const name of Object.keys(deps as Record<string, unknown>)) {
        if (name === 'mastra' || name.startsWith('@mastra/')) names.add(name);
      }
    }
  }
  return [...names];
}

function normalizeManagedManifest(
  content: string,
  mastraVersions: ResolvedMastraVersions | undefined,
  fallbackTag: string,
): TransformResult {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { applied: false, content };
  }

  const dependencies = getDependencyMap(manifest, 'dependencies');
  const devDependencies = getDependencyMap(manifest, 'devDependencies');
  if (!dependencies || (manifest.devDependencies !== undefined && !devDependencies)) {
    return { applied: false, content };
  }

  const dependencySections = [dependencies, devDependencies].filter(
    (section): section is Record<string, unknown> => section !== undefined,
  );
  for (const section of dependencySections) {
    for (const packageName of Object.keys(section)) {
      if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
        section[packageName] = mastraVersions?.[packageName] ?? fallbackTag;
      }
    }
  }

  return { applied: true, content: `${JSON.stringify(manifest, null, 2)}\n` };
}

function adaptAgentSource(source: string, provider: CreateLLMProvider, config: ManagedProviderConfig): TransformResult {
  if (provider === 'openai') return { applied: true, content: source };
  if (!config.primaryModel || !config.observationalModel) return { applied: false, content: source };
  if (findMatches(source, PRIMARY_OPENAI_MODEL).length !== 1) return { applied: false, content: source };
  if (findMatches(source, OBSERVATIONAL_OPENAI_MODEL).length !== 1) return { applied: false, content: source };

  return {
    applied: true,
    content: source
      .replace(PRIMARY_OPENAI_MODEL, `$1${config.primaryModel}$2`)
      .replace(OBSERVATIONAL_OPENAI_MODEL, `$1${config.observationalModel}$2`),
  };
}

function replaceEnvKey(source: string, nextKey: string): TransformResult {
  return replaceSingleMatch(
    source,
    new RegExp(`^([ \\t]*)${OPENAI_API_KEY}[ \\t]*=.*$`, 'm'),
    (_line, indentation: string) => `${indentation}${nextKey}=`,
  );
}

function setEnvValue(source: string, key: string, value: string): TransformResult {
  return replaceSingleMatch(
    source,
    new RegExp(`^([ \\t]*)${key}[ \\t]*=.*$`, 'm'),
    (_line, indentation: string) => `${indentation}${key}=${value}`,
  );
}

function adaptReadme(
  source: string,
  provider: CreateLLMProvider,
  config: ManagedProviderConfig,
  projectName: string,
  packageManager: PackageManager,
): TransformResult {
  const hasManagedProviderWording =
    source.includes(OPENAI_API_KEY) || /^([ \t]*)npx create-mastra@\S+.*$/m.test(source);
  if (!hasManagedProviderWording) return { applied: false, content: source };

  const content = source
    .replace(/^# .+$/m, `# ${projectName}`)
    .replaceAll('npm run dev', `${packageManager} run dev`)
    .replace(/^([ \t]*)npx create-mastra@\S+.*$/m, `$1npx create-mastra@latest <project-name> --llm ${provider}`)
    .replaceAll(OPENAI_API_KEY, config.apiKeyEnv);
  return { applied: true, content };
}

async function writeSecureEnv(envPath: string, content: string): Promise<boolean> {
  const tempPath = path.join(path.dirname(envPath), `.env.mastra-create-${process.pid}-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    if (process.platform !== 'win32') await fs.chmod(tempPath, 0o600);
    await fs.rename(tempPath, envPath);
    return true;
  } catch {
    try {
      await fs.rm(tempPath, { force: true });
    } catch {}
    return false;
  }
}

export async function adaptDefaultTemplate({
  projectPath,
  projectName,
  packageManager,
  provider,
  apiKey,
  versionTag,
}: {
  projectPath: string;
  projectName: string;
  packageManager: PackageManager;
  provider: CreateLLMProvider;
  apiKey?: string;
  versionTag: string;
}): Promise<ManagedTemplateAdaptationResult> {
  const config = MANAGED_PROVIDER_CONFIGS[provider];
  let adaptationFailed = false;
  const write = async (filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return true;
    } catch {
      adaptationFailed = true;
      return false;
    }
  };

  const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
  if (provider !== 'openai') {
    try {
      const source = await fs.readFile(agentPath, 'utf8');
      const result = adaptAgentSource(source, provider, config);
      if (!result.applied) adaptationFailed = true;
      else await write(agentPath, result.content);
    } catch {
      adaptationFailed = true;
    }
  }

  const packageJsonPath = path.join(projectPath, 'package.json');
  try {
    const source = await fs.readFile(packageJsonPath, 'utf8');
    const mastraPackages = collectMastraPackages(source);
    const resolvedVersions = await resolveMastraPackageVersions(mastraPackages, versionTag);
    if (resolvedVersions === undefined && mastraPackages.length > 0) {
      console.warn(
        `We could not resolve exact Mastra package versions for the "${versionTag}" channel, using the channel tag instead`,
      );
    }
    const result = normalizeManagedManifest(source, resolvedVersions, versionTag);
    if (!result.applied) adaptationFailed = true;
    else await write(packageJsonPath, result.content);
  } catch {
    adaptationFailed = true;
  }

  const envExamplePath = path.join(projectPath, '.env.example');
  const envPath = path.join(projectPath, '.env');
  let adaptedEnvExample: string | undefined;
  try {
    const source = await fs.readFile(envExamplePath, 'utf8');
    const result = replaceEnvKey(source, config.apiKeyEnv);
    if (!result.applied) {
      adaptationFailed = true;
    } else if (await write(envExamplePath, result.content)) {
      adaptedEnvExample = result.content;
    }
  } catch {
    adaptationFailed = true;
  }

  let apiKeyWritten = false;
  if (adaptedEnvExample === undefined) {
    if (apiKey) adaptationFailed = true;
  } else if (apiKey) {
    const result = setEnvValue(adaptedEnvExample, config.apiKeyEnv, apiKey);
    if (!result.applied) {
      adaptationFailed = true;
    } else {
      apiKeyWritten = await writeSecureEnv(envPath, result.content);
      if (!apiKeyWritten) adaptationFailed = true;
    }
  } else {
    try {
      await fs.rm(envPath, { force: true });
    } catch {
      adaptationFailed = true;
    }
  }

  const readmePath = path.join(projectPath, 'README.md');
  try {
    const source = await fs.readFile(readmePath, 'utf8');
    const result = adaptReadme(source, provider, config, projectName, packageManager);
    if (!result.applied) adaptationFailed = true;
    else await write(readmePath, result.content);
  } catch {
    adaptationFailed = true;
  }

  if (packageManager === 'pnpm') {
    await write(path.join(projectPath, 'pnpm-workspace.yaml'), PNPM_WORKSPACE);
  }

  return {
    ...config,
    apiKeyWritten,
    adaptationFailed,
  };
}

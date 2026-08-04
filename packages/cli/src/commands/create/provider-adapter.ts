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
  apiKeyPrerequisite: string;
}

export const MANAGED_PROVIDER_CONFIGS: Record<CreateLLMProvider, ManagedProviderConfig> = {
  openai: {
    displayName: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyPrerequisite: 'An OpenAI API key',
  },
  anthropic: {
    displayName: 'Anthropic',
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeyPrerequisite: 'An Anthropic API key',
  },
  google: {
    displayName: 'Google Gemini',
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
    apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
    apiKeyPrerequisite: 'A Google Gemini API key',
  },
  xai: {
    displayName: 'xAI',
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
    apiKeyEnv: 'XAI_API_KEY',
    apiKeyPrerequisite: 'An xAI API key',
  },
};

const OPENAI_API_KEY = 'OPENAI_API_KEY';
const OPENAI_MODEL = /(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g;

function findMatches(content: string, pattern: RegExp): RegExpMatchArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...content.matchAll(new RegExp(pattern.source, flags))];
}

function replaceSingleMatch(
  content: string,
  pattern: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
  description: string,
  fileName: string,
): string {
  const matches = findMatches(content, pattern);
  if (matches.length !== 1) {
    throw new Error(
      `Default template compatibility error: expected one ${description} in ${fileName}, found ${matches.length}.`,
    );
  }
  if (typeof replacement === 'string') return content.replace(pattern, replacement);
  return content.replace(pattern, replacement);
}

function getDependencyMap(manifest: Record<string, unknown>, section: 'dependencies' | 'devDependencies') {
  const value = manifest[section];
  if (value === undefined && section === 'devDependencies') return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Default template compatibility error: package.json has invalid ${section}.`);
  }
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
): string {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('Default template compatibility error: package.json is not valid JSON.');
  }

  const dependencies = getDependencyMap(manifest, 'dependencies')!;
  const devDependencies = getDependencyMap(manifest, 'devDependencies');
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

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function adaptAgentSource(source: string, provider: CreateLLMProvider, config: ManagedProviderConfig): string {
  if (provider === 'openai') return source;
  if (!config.primaryModel || !config.observationalModel) {
    throw new Error(`Default template compatibility error: model configuration is missing for ${config.displayName}.`);
  }

  const modelMatches = findMatches(source, OPENAI_MODEL);
  if (modelMatches.length !== 2) {
    throw new Error(
      `Default template compatibility error: expected two OpenAI model assignments in src/mastra/agents/agent.ts, found ${modelMatches.length}.`,
    );
  }
  const models = [config.primaryModel, config.observationalModel];
  let modelIndex = 0;
  return source.replace(OPENAI_MODEL, (_match, prefix: string, suffix: string) => {
    const model = models[modelIndex++]!;
    return `${prefix}${model}${suffix}`;
  });
}

function replaceEnvKey(source: string, nextKey: string): string {
  return replaceSingleMatch(
    source,
    new RegExp(`^([ \\t]*)${OPENAI_API_KEY}[ \\t]*=.*$`, 'm'),
    (_line, indentation: string) => `${indentation}${nextKey}=`,
    `${OPENAI_API_KEY} assignment`,
    '.env.example',
  );
}

function setEnvValue(source: string, key: string, value: string): string {
  return replaceSingleMatch(
    source,
    new RegExp(`^([ \\t]*)${key}[ \\t]*=.*$`, 'm'),
    (_line, indentation: string) => `${indentation}${key}=${value}`,
    `${key} assignment`,
    '.env',
  );
}

function adaptReadme(
  source: string,
  provider: CreateLLMProvider,
  config: ManagedProviderConfig,
  projectName: string,
  packageManager: PackageManager,
): string {
  return source
    .replace(/^# .+$/m, `# ${projectName}`)
    .replaceAll('npm run dev', `${packageManager} run dev`)
    .replace(/^- .*OpenAI API key.*$/m, `- ${config.apiKeyPrerequisite}`)
    .replace(/^([ \t]*)npx create-mastra@\S+.*$/m, `$1npx create-mastra@latest <project-name> --llm ${provider}`)
    .replaceAll(OPENAI_API_KEY, config.apiKeyEnv);
}

function assertNoProviderResidue(
  provider: CreateLLMProvider,
  files: { agent: string; manifest: string; envExample: string; env?: string },
): void {
  for (const [otherProvider, config] of Object.entries(MANAGED_PROVIDER_CONFIGS) as Array<
    [CreateLLMProvider, ManagedProviderConfig]
  >) {
    if (otherProvider === provider) continue;

    const checks: Array<[string, string]> = [
      [files.agent, `${otherProvider}/`],
      [files.envExample, config.apiKeyEnv],
    ];
    if (files.env !== undefined) checks.push([files.env, config.apiKeyEnv]);
    for (const [content, residue] of checks) {
      if (content.includes(residue)) {
        throw new Error(
          `Default template compatibility error: generated project still contains ${JSON.stringify(residue)} from ${config.displayName}.`,
        );
      }
    }
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
}): Promise<ManagedProviderConfig> {
  const config = MANAGED_PROVIDER_CONFIGS[provider];
  const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
  const packageJsonPath = path.join(projectPath, 'package.json');
  const envExamplePath = path.join(projectPath, '.env.example');
  const envPath = path.join(projectPath, '.env');
  const readmePath = path.join(projectPath, 'README.md');

  let agentSource: string;
  let packageJsonSource: string;
  let envExampleSource: string;
  try {
    [agentSource, packageJsonSource, envExampleSource] = await Promise.all([
      fs.readFile(agentPath, 'utf8'),
      fs.readFile(packageJsonPath, 'utf8'),
      fs.readFile(envExamplePath, 'utf8'),
    ]);
  } catch (error) {
    throw new Error(
      `Default template compatibility error: required template file is missing or unreadable: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  const readmeSource = await fs.readFile(readmePath, 'utf8').catch(() => undefined);
  const nextAgent = adaptAgentSource(agentSource, provider, config);
  const mastraPackages = collectMastraPackages(packageJsonSource);
  const resolvedVersions = await resolveMastraPackageVersions(mastraPackages, versionTag);
  if (resolvedVersions === undefined && mastraPackages.length > 0) {
    console.warn(
      `We could not resolve exact Mastra package versions for the "${versionTag}" channel, using the channel tag instead`,
    );
  }
  const normalizedManifest = normalizeManagedManifest(packageJsonSource, resolvedVersions, versionTag);
  const nextEnvExample = replaceEnvKey(envExampleSource, config.apiKeyEnv);
  const nextEnv = apiKey ? setEnvValue(nextEnvExample, config.apiKeyEnv, apiKey) : undefined;
  const nextReadme =
    readmeSource === undefined ? undefined : adaptReadme(readmeSource, provider, config, projectName, packageManager);

  assertNoProviderResidue(provider, {
    agent: nextAgent,
    manifest: normalizedManifest,
    envExample: nextEnvExample,
    env: nextEnv,
  });

  const writes = [
    fs.writeFile(agentPath, nextAgent, 'utf8'),
    fs.writeFile(packageJsonPath, normalizedManifest, 'utf8'),
    fs.writeFile(envExamplePath, nextEnvExample, 'utf8'),
    nextEnv === undefined ? fs.rm(envPath, { force: true }) : fs.writeFile(envPath, nextEnv, 'utf8'),
  ];
  if (nextReadme !== undefined) writes.push(fs.writeFile(readmePath, nextReadme, 'utf8'));
  if (packageManager === 'pnpm') {
    writes.push(fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), PNPM_WORKSPACE, 'utf8'));
  }
  await Promise.all(writes);
  if (nextEnv !== undefined && process.platform !== 'win32') await fs.chmod(envPath, 0o600);

  return config;
}

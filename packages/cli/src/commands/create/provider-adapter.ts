import fs from 'node:fs/promises';
import path from 'node:path';

import type { PackageManager } from '../../utils/package-manager';
import type { CreateLLMProvider } from './command';
import { PNPM_WORKSPACE } from './utils';

export interface ManagedProviderConfig {
  displayName: string;
  sdkPackage: string;
  sdkVersion?: string;
  providerIdentifier: string;
  primaryModel?: string;
  observationalModel?: string;
  apiKeyEnv: string;
  apiKeyPrerequisite: string;
  featureDescription: string;
  webSearchEntry?: string;
}

interface ResolvedManagedProviderConfig extends ManagedProviderConfig {
  sdkVersion: string;
}

export const MANAGED_PROVIDER_CONFIGS: Record<CreateLLMProvider, ManagedProviderConfig> = {
  openai: {
    displayName: 'OpenAI',
    sdkPackage: '@ai-sdk/openai',
    providerIdentifier: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyPrerequisite: 'An OpenAI API key',
    featureDescription: 'OpenAI web search and direct web page fetching',
  },
  anthropic: {
    displayName: 'Anthropic',
    sdkPackage: '@ai-sdk/anthropic',
    sdkVersion: '^3.0.96',
    providerIdentifier: 'anthropic',
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeyPrerequisite: 'An Anthropic API key',
    featureDescription: 'Anthropic web search and direct web page fetching',
    webSearchEntry: 'anthropic.tools.webSearch_20250305()',
  },
  google: {
    displayName: 'Google Gemini',
    sdkPackage: '@ai-sdk/google',
    sdkVersion: '^3.0.91',
    providerIdentifier: 'google',
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
    apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
    apiKeyPrerequisite: 'A Google Gemini API key',
    featureDescription: 'Google Gemini web search and direct web page fetching',
    webSearchEntry: 'google.tools.googleSearch({})',
  },
  xai: {
    displayName: 'xAI',
    sdkPackage: '@ai-sdk/xai',
    sdkVersion: '^3.0.106',
    providerIdentifier: 'xai',
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
    apiKeyEnv: 'XAI_API_KEY',
    apiKeyPrerequisite: 'An xAI API key',
    featureDescription: 'xAI web search and direct web page fetching',
    webSearchEntry: 'xai.tools.webSearch()',
  },
};

const PROVIDER_SDK_PACKAGES = Object.values(MANAGED_PROVIDER_CONFIGS).map(config => config.sdkPackage);
const OPENAI_SDK_PACKAGE = '@ai-sdk/openai';
const OPENAI_API_KEY = 'OPENAI_API_KEY';
const OPENAI_IMPORT = /^import\s*\{\s*openai\s*\}\s*from\s*['"]@ai-sdk\/openai['"];?\s*$/m;
const OPENAI_MODEL = /(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g;
const WEB_SEARCH_PROPERTY = /^([ \t]*)web_search\s*:\s*([^\n]+?)(?:,)?\s*$/m;

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

function normalizeManagedManifest(
  content: string,
  provider: ManagedProviderConfig,
  versionTag: string,
): { content: string; sdkVersion: string } {
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
  const openAiLocations = dependencySections.filter(section => Object.hasOwn(section, OPENAI_SDK_PACKAGE));
  if (openAiLocations.length !== 1) {
    throw new Error(
      `Default template compatibility error: package.json must contain ${OPENAI_SDK_PACKAGE} in exactly one dependency section.`,
    );
  }

  const sourceSection = openAiLocations[0]!;
  const templateOpenAiVersion = sourceSection[OPENAI_SDK_PACKAGE];
  if (typeof templateOpenAiVersion !== 'string' || templateOpenAiVersion.trim() === '') {
    throw new Error(
      `Default template compatibility error: package.json must contain a nonempty ${OPENAI_SDK_PACKAGE} version.`,
    );
  }

  for (const section of dependencySections) {
    for (const packageName of PROVIDER_SDK_PACKAGES) delete section[packageName];
  }

  const sdkVersion = provider.sdkPackage === OPENAI_SDK_PACKAGE ? templateOpenAiVersion : provider.sdkVersion;
  if (!sdkVersion) {
    throw new Error(`Default template compatibility error: no SDK version is configured for ${provider.displayName}.`);
  }
  sourceSection[provider.sdkPackage] = sdkVersion;

  for (const section of dependencySections) {
    for (const packageName of Object.keys(section)) {
      if (packageName === 'mastra' || packageName.startsWith('@mastra/')) section[packageName] = versionTag;
    }
  }

  return { content: `${JSON.stringify(manifest, null, 2)}\n`, sdkVersion };
}

function adaptAgentSource(source: string, provider: CreateLLMProvider, config: ManagedProviderConfig): string {
  if (provider === 'openai') return source;
  if (!config.primaryModel || !config.observationalModel) {
    throw new Error(`Default template compatibility error: model configuration is missing for ${config.displayName}.`);
  }

  let next = replaceSingleMatch(
    source,
    OPENAI_IMPORT,
    `import { ${config.providerIdentifier} } from '${config.sdkPackage}';`,
    'OpenAI provider import',
    'src/mastra/agents/agent.ts',
  );

  const modelMatches = findMatches(next, OPENAI_MODEL);
  if (modelMatches.length !== 2) {
    throw new Error(
      `Default template compatibility error: expected two OpenAI model assignments in src/mastra/agents/agent.ts, found ${modelMatches.length}.`,
    );
  }
  const models = [config.primaryModel, config.observationalModel];
  let modelIndex = 0;
  next = next.replace(OPENAI_MODEL, (_match, prefix: string, suffix: string) => {
    const model = models[modelIndex++]!;
    return `${prefix}${model}${suffix}`;
  });

  const webSearchMatches = findMatches(next, WEB_SEARCH_PROPERTY);
  if (webSearchMatches.length > 1) {
    throw new Error(
      `Default template compatibility error: expected at most one web_search property in src/mastra/agents/agent.ts, found ${webSearchMatches.length}.`,
    );
  }

  if (webSearchMatches.length === 1) {
    const match = webSearchMatches[0]!;
    if (!match[2]?.includes('openai.')) {
      throw new Error(
        'Default template compatibility error: the existing web_search property is not owned by the OpenAI template.',
      );
    }
    next = next.replace(
      WEB_SEARCH_PROPERTY,
      config.webSearchEntry ? `${match[1]}web_search: ${config.webSearchEntry},` : '',
    );
  } else if (config.webSearchEntry) {
    next = replaceSingleMatch(
      next,
      /^([ \t]*)web_fetch\s*:\s*[^\n]+$/m,
      (_line, indentation: string) =>
        `${indentation}web_fetch: webFetchTool,\n${indentation}web_search: ${config.webSearchEntry},`,
      'web_fetch property used to place web_search',
      'src/mastra/agents/agent.ts',
    );
  }

  return next;
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
    .replace(/^- .*OpenAI web search.*$/m, `- ${config.featureDescription}`)
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
      [files.manifest, config.sdkPackage],
      [files.agent, `${config.providerIdentifier}/`],
      [files.agent, `${config.providerIdentifier}.tools`],
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
}): Promise<ResolvedManagedProviderConfig> {
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
  const normalizedManifest = normalizeManagedManifest(packageJsonSource, config, versionTag);
  const nextEnvExample = replaceEnvKey(envExampleSource, config.apiKeyEnv);
  const nextEnv = apiKey ? setEnvValue(nextEnvExample, config.apiKeyEnv, apiKey) : undefined;
  const nextReadme =
    readmeSource === undefined ? undefined : adaptReadme(readmeSource, provider, config, projectName, packageManager);

  assertNoProviderResidue(provider, {
    agent: nextAgent,
    manifest: normalizedManifest.content,
    envExample: nextEnvExample,
    env: nextEnv,
  });

  const writes = [
    fs.writeFile(agentPath, nextAgent, 'utf8'),
    fs.writeFile(packageJsonPath, normalizedManifest.content, 'utf8'),
    fs.writeFile(envExamplePath, nextEnvExample, 'utf8'),
    nextEnv === undefined ? fs.rm(envPath, { force: true }) : fs.writeFile(envPath, nextEnv, 'utf8'),
  ];
  if (nextReadme !== undefined) writes.push(fs.writeFile(readmePath, nextReadme, 'utf8'));
  if (packageManager === 'pnpm') {
    writes.push(fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), PNPM_WORKSPACE, 'utf8'));
  }
  await Promise.all(writes);
  if (nextEnv !== undefined && process.platform !== 'win32') await fs.chmod(envPath, 0o600);

  return { ...config, sdkVersion: normalizedManifest.sdkVersion };
}

import fs from 'node:fs/promises';
import path from 'node:path';

import type { CreateLLMProvider } from './command';

export interface ManagedProviderConfig {
  displayName: string;
  sdkPackage: string;
  sdkVersion: string;
  providerIdentifier: string;
  primaryModel: string;
  observationalModel: string;
  apiKeyEnv: string;
  apiKeyPrerequisite: string;
  featureDescription: string;
  webSearchEntry?: string;
}

export const MANAGED_PROVIDER_CONFIGS: Record<CreateLLMProvider, ManagedProviderConfig> = {
  openai: {
    displayName: 'OpenAI',
    sdkPackage: '@ai-sdk/openai',
    sdkVersion: '^4.0.8',
    providerIdentifier: 'openai',
    primaryModel: 'openai/gpt-5.6-terra',
    observationalModel: 'openai/gpt-5-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyPrerequisite: 'An OpenAI API key',
    featureDescription: 'OpenAI web search and direct web page fetching',
    webSearchEntry: 'openai.tools.webSearch()',
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
    featureDescription: 'Direct web page fetching',
  },
};

const PROVIDER_SDK_PACKAGES = Object.values(MANAGED_PROVIDER_CONFIGS).map(config => config.sdkPackage);

const AGENT_IMPORT = "import { openai } from '@ai-sdk/openai';";
const PRIMARY_MODEL = "  model: 'openai/gpt-5.6-terra',";
const OBSERVATIONAL_MODEL = "        model: 'openai/gpt-5-mini',";
const WEB_SEARCH = '    web_search: openai.tools.webSearch(),';
const README_FEATURE = '- OpenAI web search and direct web page fetching';
const README_PREREQUISITE = '- An [OpenAI API key](https://platform.openai.com/api-keys)';
const README_CREATE_COMMAND = '   npx create-mastra@latest --template agent-harness';
const README_ENV_SETUP = '2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.';
const ENV_EXAMPLE = 'OPENAI_API_KEY=';

function countOccurrences(content: string, anchor: string): number {
  return content.split(anchor).length - 1;
}

function replaceExactly(content: string, anchor: string, replacement: string, fileName: string): string {
  const occurrences = countOccurrences(content, anchor);
  if (occurrences !== 1) {
    throw new Error(
      `Managed agent-harness compatibility error: expected exactly one ${JSON.stringify(anchor)} anchor in ${fileName}, found ${occurrences}.`,
    );
  }

  return content.replace(anchor, replacement);
}

function normalizeManagedManifest(content: string, provider: ManagedProviderConfig, versionTag: string): string {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('Managed agent-harness compatibility error: package.json is not valid JSON.');
  }

  const dependencies = manifest.dependencies;
  const devDependencies = manifest.devDependencies;
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw new Error('Managed agent-harness compatibility error: package.json is missing dependencies.');
  }
  if (!devDependencies || typeof devDependencies !== 'object' || Array.isArray(devDependencies)) {
    throw new Error('Managed agent-harness compatibility error: package.json is missing devDependencies.');
  }

  const dependencyMap = dependencies as Record<string, string>;
  const devDependencyMap = devDependencies as Record<string, string>;
  if (dependencyMap['@ai-sdk/openai'] !== '^4.0.8') {
    throw new Error(
      'Managed agent-harness compatibility error: package.json does not contain the expected @ai-sdk/openai dependency.',
    );
  }

  for (const packageName of PROVIDER_SDK_PACKAGES) {
    delete dependencyMap[packageName];
    delete devDependencyMap[packageName];
  }
  dependencyMap[provider.sdkPackage] = provider.sdkVersion;

  for (const dependencySection of [dependencyMap, devDependencyMap]) {
    for (const packageName of Object.keys(dependencySection)) {
      if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
        dependencySection[packageName] = versionTag;
      }
    }
  }

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function assertNoProviderResidue(provider: CreateLLMProvider, files: Record<string, string>): void {
  const combined = Object.entries(files)
    .map(([fileName, content]) => `${fileName}\n${content}`)
    .join('\n');

  for (const [otherProvider, config] of Object.entries(MANAGED_PROVIDER_CONFIGS) as Array<
    [CreateLLMProvider, ManagedProviderConfig]
  >) {
    if (otherProvider === provider) continue;

    const forbidden = [
      config.sdkPackage,
      `${config.providerIdentifier}/`,
      config.apiKeyEnv,
      `${config.providerIdentifier}.tools`,
      config.displayName,
    ];
    for (const residue of forbidden) {
      if (combined.includes(residue)) {
        throw new Error(
          `Managed agent-harness compatibility error: generated project still contains ${JSON.stringify(residue)} from ${config.displayName}.`,
        );
      }
    }
  }
}

export async function adaptManagedAgentHarness({
  projectPath,
  provider,
  apiKey,
  versionTag,
}: {
  projectPath: string;
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
  let readmeSource: string;
  try {
    [agentSource, packageJsonSource, envExampleSource, readmeSource] = await Promise.all([
      fs.readFile(agentPath, 'utf8'),
      fs.readFile(packageJsonPath, 'utf8'),
      fs.readFile(envExamplePath, 'utf8'),
      fs.readFile(readmePath, 'utf8'),
    ]);
  } catch (error) {
    throw new Error(
      `Managed agent-harness compatibility error: required template file is missing or unreadable: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  let nextAgent = replaceExactly(
    agentSource,
    AGENT_IMPORT,
    `import { ${config.providerIdentifier} } from '${config.sdkPackage}';`,
    'src/mastra/agents/agent.ts',
  );
  nextAgent = replaceExactly(
    nextAgent,
    PRIMARY_MODEL,
    `  model: '${config.primaryModel}',`,
    'src/mastra/agents/agent.ts',
  );
  nextAgent = replaceExactly(
    nextAgent,
    OBSERVATIONAL_MODEL,
    `        model: '${config.observationalModel}',`,
    'src/mastra/agents/agent.ts',
  );
  nextAgent = replaceExactly(
    nextAgent,
    WEB_SEARCH,
    config.webSearchEntry ? `    web_search: ${config.webSearchEntry},` : '',
    'src/mastra/agents/agent.ts',
  );

  let nextReadme = replaceExactly(readmeSource, README_FEATURE, `- ${config.featureDescription}`, 'README.md');
  nextReadme = replaceExactly(nextReadme, README_PREREQUISITE, `- ${config.apiKeyPrerequisite}`, 'README.md');
  nextReadme = replaceExactly(
    nextReadme,
    README_CREATE_COMMAND,
    `   npx create-mastra@latest <project-name> --llm ${provider}`,
    'README.md',
  );
  nextReadme = replaceExactly(
    nextReadme,
    README_ENV_SETUP,
    `2. Copy \`.env.example\` to \`.env\` and set \`${config.apiKeyEnv}\`.`,
    'README.md',
  );

  if (countOccurrences(envExampleSource, ENV_EXAMPLE) !== 1 || envExampleSource.trim() !== ENV_EXAMPLE) {
    throw new Error(
      'Managed agent-harness compatibility error: .env.example does not contain the expected OPENAI_API_KEY anchor.',
    );
  }

  const nextFiles = {
    'src/mastra/agents/agent.ts': nextAgent,
    'package.json': normalizeManagedManifest(packageJsonSource, config, versionTag),
    '.env.example': `${config.apiKeyEnv}=\n`,
    '.env': `${config.apiKeyEnv}=${apiKey ?? ''}\n`,
    'README.md': nextReadme,
  };
  assertNoProviderResidue(provider, nextFiles);

  await Promise.all([
    fs.writeFile(agentPath, nextFiles['src/mastra/agents/agent.ts'], 'utf8'),
    fs.writeFile(packageJsonPath, nextFiles['package.json'], 'utf8'),
    fs.writeFile(envExamplePath, nextFiles['.env.example'], 'utf8'),
    fs.writeFile(envPath, nextFiles['.env'], { encoding: 'utf8', mode: 0o600 }),
    fs.writeFile(readmePath, nextFiles['README.md'], 'utf8'),
  ]);

  return config;
}

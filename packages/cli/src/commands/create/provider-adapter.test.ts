import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CreateLLMProvider } from './command';
import { adaptManagedAgentHarness, MANAGED_PROVIDER_CONFIGS } from './provider-adapter';

const templatePath = path.resolve('../../templates/template-agent-harness');
const temporaryDirectories: string[] = [];

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-provider-adapter-'));
  temporaryDirectories.push(root);
  const projectPath = path.join(root, 'project');
  await fs.cp(templatePath, projectPath, { recursive: true });
  await fs.copyFile(path.join(projectPath, '.env.example'), path.join(projectPath, '.env'));
  return projectPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

const expected = {
  openai: {
    importLine: "import { openai } from '@ai-sdk/openai';",
    primaryModel: 'openai/gpt-5.6-terra',
    observationalModel: 'openai/gpt-5-mini',
    webSearch: 'web_search: openai.tools.webSearch(),',
    feature: 'OpenAI web search and direct web page fetching',
    prerequisite: 'An OpenAI API key',
  },
  anthropic: {
    importLine: "import { anthropic } from '@ai-sdk/anthropic';",
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
    webSearch: 'web_search: anthropic.tools.webSearch_20250305(),',
    feature: 'Anthropic web search and direct web page fetching',
    prerequisite: 'An Anthropic API key',
  },
  google: {
    importLine: "import { google } from '@ai-sdk/google';",
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
    webSearch: 'web_search: google.tools.googleSearch({}),',
    feature: 'Google Gemini web search and direct web page fetching',
    prerequisite: 'A Google Gemini API key',
  },
  xai: {
    importLine: "import { xai } from '@ai-sdk/xai';",
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
    webSearch: undefined,
    feature: 'Direct web page fetching',
    prerequisite: 'An xAI API key',
  },
} satisfies Record<
  CreateLLMProvider,
  {
    importLine: string;
    primaryModel: string;
    observationalModel: string;
    webSearch?: string;
    feature: string;
    prerequisite: string;
  }
>;

describe('adaptManagedAgentHarness', () => {
  for (const provider of Object.keys(expected) as CreateLLMProvider[]) {
    it(`adapts the harness completely for ${provider}`, async () => {
      const projectPath = await createFixture();
      const config = MANAGED_PROVIDER_CONFIGS[provider];
      const providerExpected = expected[provider];

      await adaptManagedAgentHarness({
        projectPath,
        provider,
        apiKey: 'provider-secret',
        versionTag: 'snapshot-channel',
      });

      const [agent, manifestSource, envExample, env, readme] = await Promise.all([
        fs.readFile(path.join(projectPath, 'src/mastra/agents/agent.ts'), 'utf8'),
        fs.readFile(path.join(projectPath, 'package.json'), 'utf8'),
        fs.readFile(path.join(projectPath, '.env.example'), 'utf8'),
        fs.readFile(path.join(projectPath, '.env'), 'utf8'),
        fs.readFile(path.join(projectPath, 'README.md'), 'utf8'),
      ]);
      const manifest = JSON.parse(manifestSource);

      expect(agent).toContain(providerExpected.importLine);
      expect(agent).toContain(`model: '${providerExpected.primaryModel}'`);
      expect(agent).toContain(`model: '${providerExpected.observationalModel}'`);
      expect(agent).toContain('web_fetch: webFetchTool');
      if (providerExpected.webSearch) {
        expect(agent).toContain(providerExpected.webSearch);
      } else {
        expect(agent).not.toContain('web_search:');
      }

      expect(manifest.dependencies[config.sdkPackage]).toBe(config.sdkVersion);
      for (const providerConfig of Object.values(MANAGED_PROVIDER_CONFIGS)) {
        if (providerConfig.sdkPackage !== config.sdkPackage) {
          expect(manifest.dependencies[providerConfig.sdkPackage]).toBeUndefined();
          expect(manifest.devDependencies[providerConfig.sdkPackage]).toBeUndefined();
        }
      }
      for (const section of [manifest.dependencies, manifest.devDependencies]) {
        for (const [packageName, version] of Object.entries(section)) {
          if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
            expect(version).toBe('snapshot-channel');
          }
        }
      }
      expect(manifest.dependencies.zod).toBe('^4.4.3');

      expect(envExample).toBe(`${config.apiKeyEnv}=\n`);
      expect(env).toBe(`${config.apiKeyEnv}=provider-secret\n`);
      if (process.platform !== 'win32') {
        expect((await fs.stat(path.join(projectPath, '.env'))).mode & 0o777).toBe(0o600);
      }
      expect(readme).toContain(`- ${providerExpected.feature}`);
      expect(readme).toContain(`- ${providerExpected.prerequisite}`);
      expect(readme).toContain(`npx create-mastra@latest <project-name> --llm ${provider}`);
      expect(readme).toContain(`set \`${config.apiKeyEnv}\``);

      const managedFiles = `${agent}\n${manifestSource}\n${envExample}\n${env}\n${readme}`;
      for (const [otherProvider, otherConfig] of Object.entries(MANAGED_PROVIDER_CONFIGS) as Array<
        [CreateLLMProvider, (typeof MANAGED_PROVIDER_CONFIGS)[CreateLLMProvider]]
      >) {
        if (otherProvider === provider) continue;
        expect(managedFiles).not.toContain(otherConfig.sdkPackage);
        expect(managedFiles).not.toContain(`${otherConfig.providerIdentifier}/`);
        expect(managedFiles).not.toContain(otherConfig.apiKeyEnv);
        expect(managedFiles).not.toContain(`${otherConfig.providerIdentifier}.tools`);
      }
    });
  }

  it('keeps the example placeholder actionable when the API key is skipped', async () => {
    const projectPath = await createFixture();

    await adaptManagedAgentHarness({ projectPath, provider: 'anthropic', versionTag: 'latest' });

    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toBe('ANTHROPIC_API_KEY=\n');
    expect(await fs.readFile(path.join(projectPath, '.env'), 'utf8')).toBe('ANTHROPIC_API_KEY=\n');
  });

  it('fails before writing when a required anchor is missing', async () => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const originalAgent = await fs.readFile(agentPath, 'utf8');
    await fs.writeFile(agentPath, originalAgent.replace("  model: 'openai/gpt-5.6-terra',\n", ''), 'utf8');
    const beforeAttempt = await fs.readFile(agentPath, 'utf8');

    await expect(adaptManagedAgentHarness({ projectPath, provider: 'google', versionTag: 'latest' })).rejects.toThrow(
      'expected exactly one',
    );

    expect(await fs.readFile(agentPath, 'utf8')).toBe(beforeAttempt);
    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toBe('OPENAI_API_KEY=\n');
  });

  it('fails when a required README anchor is duplicated', async () => {
    const projectPath = await createFixture();
    const readmePath = path.join(projectPath, 'README.md');
    const readme = await fs.readFile(readmePath, 'utf8');
    await fs.writeFile(readmePath, `${readme}\n- OpenAI web search and direct web page fetching\n`, 'utf8');

    await expect(adaptManagedAgentHarness({ projectPath, provider: 'xai', versionTag: 'latest' })).rejects.toThrow(
      'found 2',
    );
  });
});

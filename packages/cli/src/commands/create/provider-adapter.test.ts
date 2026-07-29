import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { CreateLLMProvider } from './command';
import { adaptDefaultTemplate, MANAGED_PROVIDER_CONFIGS } from './provider-adapter';
import { PNPM_WORKSPACE } from './utils';

const templatePath = fileURLToPath(new URL('../../../../../templates/template-agent-harness', import.meta.url));
const temporaryDirectories: string[] = [];

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-provider-adapter-'));
  temporaryDirectories.push(root);
  const projectPath = path.join(root, 'project');
  await fs.cp(templatePath, projectPath, { recursive: true });
  await fs.copyFile(path.join(projectPath, '.env.example'), path.join(projectPath, '.env'));
  return projectPath;
}

type AdaptDefaultTemplateOptions = Parameters<typeof adaptDefaultTemplate>[0];

function adaptFixture(
  options: Omit<AdaptDefaultTemplateOptions, 'projectName' | 'packageManager'> &
    Partial<Pick<AdaptDefaultTemplateOptions, 'projectName' | 'packageManager'>>,
) {
  return adaptDefaultTemplate({
    projectName: 'my-agent',
    packageManager: 'npm',
    ...options,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

const expectedAdaptations = {
  anthropic: {
    importLine: "import { anthropic } from '@ai-sdk/anthropic';",
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
    webSearch: 'web_search: anthropic.tools.webSearch_20250305(),',
    feature: 'Anthropic web search and direct web page fetching',
  },
  google: {
    importLine: "import { google } from '@ai-sdk/google';",
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
    webSearch: 'web_search: google.tools.googleSearch({}),',
    feature: 'Google Gemini web search and direct web page fetching',
  },
  xai: {
    importLine: "import { xai } from '@ai-sdk/xai';",
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
    webSearch: 'web_search: xai.tools.webSearch(),',
    feature: 'xAI web search and direct web page fetching',
  },
} satisfies Record<
  Exclude<CreateLLMProvider, 'openai'>,
  {
    importLine: string;
    primaryModel: string;
    observationalModel: string;
    webSearch?: string;
    feature: string;
  }
>;

describe('adaptDefaultTemplate', () => {
  for (const provider of Object.keys(MANAGED_PROVIDER_CONFIGS) as CreateLLMProvider[]) {
    it(`adapts the default template completely for ${provider}`, async () => {
      const projectPath = await createFixture();
      const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
      const manifestPath = path.join(projectPath, 'package.json');
      const originalAgent = await fs.readFile(agentPath, 'utf8');
      const originalManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      const config = MANAGED_PROVIDER_CONFIGS[provider];

      const resolvedConfig = await adaptFixture({
        projectPath,
        projectName: `${provider}-project`,
        packageManager: 'pnpm',
        provider,
        apiKey: 'provider-secret',
        versionTag: 'snapshot-channel',
      });

      const [agent, manifestSource, envExample, env, readme] = await Promise.all([
        fs.readFile(agentPath, 'utf8'),
        fs.readFile(manifestPath, 'utf8'),
        fs.readFile(path.join(projectPath, '.env.example'), 'utf8'),
        fs.readFile(path.join(projectPath, '.env'), 'utf8'),
        fs.readFile(path.join(projectPath, 'README.md'), 'utf8'),
      ]);
      const manifest = JSON.parse(manifestSource);

      if (provider === 'openai') {
        expect(agent).toBe(originalAgent);
        expect(resolvedConfig.sdkVersion).toBe(originalManifest.dependencies['@ai-sdk/openai']);
      } else {
        const providerExpected = expectedAdaptations[provider];
        expect(agent).toContain(providerExpected.importLine);
        expect(agent).toContain(`model: '${providerExpected.primaryModel}'`);
        expect(agent).toContain(`model: '${providerExpected.observationalModel}'`);
        if (providerExpected.webSearch) expect(agent).toContain(providerExpected.webSearch);
        else expect(agent).not.toContain('web_search:');
      }
      expect(agent).toContain('web_fetch: webFetchTool');
      expect(readme).toContain(`- ${config.featureDescription}`);
      expect(readme).toMatch(new RegExp(`^# ${provider}-project$`, 'm'));
      expect(readme).toContain('pnpm run dev');
      expect(readme).not.toMatch(/^npm run dev$/m);

      expect(manifest.dependencies[config.sdkPackage]).toBe(resolvedConfig.sdkVersion);
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
      expect(manifest.dependencies.zod).toBe(originalManifest.dependencies.zod);

      expect(envExample).toContain(`${config.apiKeyEnv}=\n`);
      expect(env).toContain(`${config.apiKeyEnv}=provider-secret\n`);
      if (process.platform !== 'win32') {
        expect((await fs.stat(path.join(projectPath, '.env'))).mode & 0o777).toBe(0o600);
      }
      expect(readme).toContain(`Set your \`${config.apiKeyEnv}\``);

      const functionalFiles = `${agent}\n${manifestSource}\n${envExample}\n${env}`;
      for (const [otherProvider, otherConfig] of Object.entries(MANAGED_PROVIDER_CONFIGS) as Array<
        [CreateLLMProvider, (typeof MANAGED_PROVIDER_CONFIGS)[CreateLLMProvider]]
      >) {
        if (otherProvider === provider) continue;
        expect(functionalFiles).not.toContain(otherConfig.sdkPackage);
        expect(functionalFiles).not.toContain(`${otherConfig.providerIdentifier}/`);
        expect(functionalFiles).not.toContain(otherConfig.apiKeyEnv);
        expect(functionalFiles).not.toContain(`${otherConfig.providerIdentifier}.tools`);
      }
    });
  }

  it('writes pnpm build-policy configuration for managed projects', async () => {
    const projectPath = await createFixture();

    await adaptFixture({
      projectPath,
      packageManager: 'pnpm',
      provider: 'openai',
      versionTag: 'latest',
    });

    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
  });

  it('preserves template-owned OpenAI versions, models, tools, and unrelated environment variables', async () => {
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const envExamplePath = path.join(projectPath, '.env.example');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.dependencies['@ai-sdk/openai'] = '^99.0.0';
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const futureModels = ['openai/future-primary', 'openai/future-observational'];
    let modelIndex = 0;
    const updatedAgent = (await fs.readFile(agentPath, 'utf8'))
      .replace(/(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g, (_match: string, prefix: string, suffix: string) => {
        return `${prefix}${futureModels[modelIndex++]!}${suffix}`;
      })
      .replace(/web_search\s*:\s*openai\.tools\.[^\n]+/, 'web_search: openai.tools.futureSearch(),');
    await fs.writeFile(agentPath, updatedAgent, 'utf8');
    await fs.writeFile(envExamplePath, '# Keep this comment\nOPENAI_API_KEY=\nTURSO_DATABASE_URL=\n', 'utf8');

    const config = await adaptFixture({ projectPath, provider: 'openai', versionTag: 'latest' });
    const adaptedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    expect(config.sdkVersion).toBe('^99.0.0');
    expect(adaptedManifest.dependencies['@ai-sdk/openai']).toBe('^99.0.0');
    expect(await fs.readFile(agentPath, 'utf8')).toBe(updatedAgent);
    expect(await fs.readFile(envExamplePath, 'utf8')).toBe(
      '# Keep this comment\nOPENAI_API_KEY=\nTURSO_DATABASE_URL=\n',
    );
  });

  it('adapts another provider when the template updates its OpenAI SDK, models, and search tool', async () => {
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.dependencies['@ai-sdk/openai'] = '^99.0.0';
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const futureModels = ['openai/future-primary', 'openai/future-observational'];
    let modelIndex = 0;
    const updatedAgent = (await fs.readFile(agentPath, 'utf8'))
      .replace(/(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g, (_match: string, prefix: string, suffix: string) => {
        return `${prefix}${futureModels[modelIndex++]!}${suffix}`;
      })
      .replace(/web_search\s*:\s*openai\.tools\.[^\n]+/, 'web_search: openai.tools.futureSearch(),');
    await fs.writeFile(agentPath, updatedAgent, 'utf8');

    await adaptFixture({ projectPath, provider: 'anthropic', versionTag: 'latest' });

    const adaptedAgent = await fs.readFile(agentPath, 'utf8');
    const adaptedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(adaptedAgent).toContain("model: 'anthropic/claude-sonnet-5'");
    expect(adaptedAgent).toContain("model: 'anthropic/claude-haiku-4-5'");
    expect(adaptedAgent).toContain('web_search: anthropic.tools.webSearch_20250305(),');
    expect(adaptedManifest.dependencies['@ai-sdk/anthropic']).toBe(MANAGED_PROVIDER_CONFIGS.anthropic.sdkVersion);
    expect(adaptedManifest.dependencies['@ai-sdk/openai']).toBeUndefined();
  });

  it('preserves extra environment entries when adapting to another provider', async () => {
    const projectPath = await createFixture();
    const envExamplePath = path.join(projectPath, '.env.example');
    await fs.writeFile(envExamplePath, '# Storage\nTURSO_DATABASE_URL=\nOPENAI_API_KEY=\n', 'utf8');

    await adaptFixture({
      projectPath,
      provider: 'anthropic',
      apiKey: 'provider-secret',
      versionTag: 'latest',
    });

    expect(await fs.readFile(envExamplePath, 'utf8')).toBe('# Storage\nTURSO_DATABASE_URL=\nANTHROPIC_API_KEY=\n');
    expect(await fs.readFile(path.join(projectPath, '.env'), 'utf8')).toBe(
      '# Storage\nTURSO_DATABASE_URL=\nANTHROPIC_API_KEY=provider-secret\n',
    );
  });

  it('keeps only .env.example when the API key is skipped', async () => {
    const projectPath = await createFixture();
    const envPath = path.join(projectPath, '.env');
    expect(await fs.stat(envPath)).toBeDefined();

    await adaptFixture({ projectPath, provider: 'anthropic', versionTag: 'latest' });

    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toContain('ANTHROPIC_API_KEY=\n');
    await expect(fs.stat(envPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails before writing when a required runtime site is missing', async () => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const originalAgent = await fs.readFile(agentPath, 'utf8');
    const incompleteAgent = originalAgent.replace(/^\s*model:\s*['"]openai\/[^'"]+['"],?\s*$/m, '');
    await fs.writeFile(agentPath, incompleteAgent, 'utf8');

    await expect(adaptFixture({ projectPath, provider: 'google', versionTag: 'latest' })).rejects.toThrow(
      'expected two OpenAI model assignments',
    );

    expect(await fs.readFile(agentPath, 'utf8')).toBe(incompleteAgent);
    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toBe('OPENAI_API_KEY=\n');
  });

  it('does not fail when provider-specific README wording changes or README is absent', async () => {
    const changedReadmeProject = await createFixture();
    const changedReadmePath = path.join(changedReadmeProject, 'README.md');
    await fs.writeFile(changedReadmePath, '# Custom project documentation\n', 'utf8');

    await expect(
      adaptFixture({ projectPath: changedReadmeProject, provider: 'xai', versionTag: 'latest' }),
    ).resolves.toBeDefined();
    expect(await fs.readFile(changedReadmePath, 'utf8')).toBe('# my-agent\n');

    const noReadmeProject = await createFixture();
    await fs.rm(path.join(noReadmeProject, 'README.md'));
    await expect(
      adaptFixture({ projectPath: noReadmeProject, provider: 'google', versionTag: 'latest' }),
    ).resolves.toBeDefined();
  });
});

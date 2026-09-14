import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateLLMProvider } from './command';
import { adaptDefaultTemplate, MANAGED_PROVIDER_CONFIGS } from './provider-adapter';
import { PNPM_WORKSPACE } from './utils';

vi.mock('execa');

const mockedExeca = vi.mocked(execa);
const templatePath = fileURLToPath(new URL('../../../../../templates/template-agent-harness', import.meta.url));
const temporaryDirectories: string[] = [];
const TEST_API_KEY = 'test-provider-key-do-not-use';
const SECURE_ENV_FAILURES =
  process.platform === 'win32' ? (['write', 'rename'] as const) : (['write', 'mode', 'rename'] as const);

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

function expectNoSecret(result: Awaited<ReturnType<typeof adaptDefaultTemplate>>) {
  expect(JSON.stringify(result)).not.toContain(TEST_API_KEY);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  mockedExeca.mockReset();
  mockedExeca.mockRejectedValue(new Error('npm unavailable') as never);
});

const expectedAdaptations = {
  anthropic: {
    primaryModel: 'anthropic/claude-sonnet-5',
    observationalModel: 'anthropic/claude-haiku-4-5',
  },
  google: {
    primaryModel: 'google/gemini-3.5-flash',
    observationalModel: 'google/gemini-3.5-flash',
  },
  xai: {
    primaryModel: 'xai/grok-4.3',
    observationalModel: 'xai/grok-4.3',
  },
} satisfies Record<Exclude<CreateLLMProvider, 'openai'>, { primaryModel: string; observationalModel: string }>;

describe('adaptDefaultTemplate', () => {
  for (const provider of Object.keys(MANAGED_PROVIDER_CONFIGS) as CreateLLMProvider[]) {
    it(`adapts the default template completely for ${provider}`, async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const projectPath = await createFixture();
      const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
      const manifestPath = path.join(projectPath, 'package.json');
      const originalAgent = await fs.readFile(agentPath, 'utf8');
      const originalManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      const config = MANAGED_PROVIDER_CONFIGS[provider];

      const result = await adaptFixture({
        projectPath,
        projectName: `${provider}-project`,
        packageManager: 'pnpm',
        provider,
        apiKey: TEST_API_KEY,
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
      } else {
        const expected = expectedAdaptations[provider];
        expect(agent).toContain(`model: '${expected.primaryModel}'`);
        expect(agent).toContain(`model: '${expected.observationalModel}'`);
      }
      expect(agent).toContain('web_fetch: webFetchTool');
      expect(agent).toContain('web_search: webSearchTool');
      expect(readme).toContain('- Built-in web search and direct web page fetching');
      expect(readme).toMatch(new RegExp(`^# ${provider}-project$`, 'm'));
      expect(readme).toContain('pnpm run dev');
      expect(readme).not.toMatch(/^npm run dev$/m);

      for (const section of [manifest.dependencies, manifest.devDependencies]) {
        expect(Object.keys(section)).not.toContainEqual(expect.stringMatching(/^@ai-sdk\//));
        for (const [packageName, version] of Object.entries(section)) {
          if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
            expect(version).toBe('snapshot-channel');
          }
        }
      }
      expect(manifest.dependencies.zod).toBe(originalManifest.dependencies.zod);
      expect(envExample).toContain(`${config.apiKeyEnv}=\n`);
      expect(env).toContain(`${config.apiKeyEnv}=${TEST_API_KEY}\n`);
      expect(result).toMatchObject({ ...config, apiKeyWritten: true, adaptationFailed: false });
      if (process.platform !== 'win32') {
        expect((await fs.stat(path.join(projectPath, '.env'))).mode & 0o777).toBe(0o600);
      }
      expect(readme).toContain(`Set your \`${config.apiKeyEnv}\``);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expectNoSecret(result);
    });
  }

  it('writes pnpm build-policy configuration for managed projects', async () => {
    const projectPath = await createFixture();
    const result = await adaptFixture({
      projectPath,
      packageManager: 'pnpm',
      provider: 'openai',
      versionTag: 'latest',
    });

    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
    expect(result.adaptationFailed).toBe(false);
  });

  it('preserves the DuckDB native external required by experiment workers', async () => {
    const projectPath = await createFixture();

    const result = await adaptFixture({ projectPath, provider: 'openai', versionTag: 'latest' });

    expect(await fs.readFile(path.join(projectPath, 'src/mastra/index.ts'), 'utf8')).toContain(
      "externals: ['@duckdb/node-bindings']",
    );
    expect(result.adaptationFailed).toBe(false);
  });

  it('preserves template-owned OpenAI models, built-in tools, and unrelated environment variables', async () => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const envExamplePath = path.join(projectPath, '.env.example');
    const futureModels = ['openai/future-primary', 'openai/future-observational'];
    let modelIndex = 0;
    const updatedAgent = (await fs.readFile(agentPath, 'utf8')).replace(
      /(\bmodel\s*:\s*['"])openai\/[^'"]+(['"])/g,
      (_match: string, prefix: string, suffix: string) => `${prefix}${futureModels[modelIndex++]!}${suffix}`,
    );
    await fs.writeFile(agentPath, updatedAgent, 'utf8');
    await fs.writeFile(envExamplePath, '# Keep this comment\nOPENAI_API_KEY=\nTURSO_DATABASE_URL=\n', 'utf8');

    const result = await adaptFixture({ projectPath, provider: 'openai', versionTag: 'latest' });

    expect(await fs.readFile(agentPath, 'utf8')).toBe(updatedAgent);
    expect(await fs.readFile(envExamplePath, 'utf8')).toBe(
      '# Keep this comment\nOPENAI_API_KEY=\nTURSO_DATABASE_URL=\n',
    );
    expect(result.adaptationFailed).toBe(false);
  });

  it('preserves extra environment entries when adapting to another provider', async () => {
    const projectPath = await createFixture();
    const envExamplePath = path.join(projectPath, '.env.example');
    await fs.writeFile(envExamplePath, '# Storage\nTURSO_DATABASE_URL=\nOPENAI_API_KEY=\n', 'utf8');

    const result = await adaptFixture({
      projectPath,
      provider: 'anthropic',
      apiKey: TEST_API_KEY,
      versionTag: 'latest',
    });

    expect(await fs.readFile(envExamplePath, 'utf8')).toBe('# Storage\nTURSO_DATABASE_URL=\nANTHROPIC_API_KEY=\n');
    expect(await fs.readFile(path.join(projectPath, '.env'), 'utf8')).toBe(
      `# Storage\nTURSO_DATABASE_URL=\nANTHROPIC_API_KEY=${TEST_API_KEY}\n`,
    );
    expect(result.apiKeyWritten).toBe(true);
  });

  it('keeps only .env.example when the API key is skipped', async () => {
    const projectPath = await createFixture();
    const envPath = path.join(projectPath, '.env');

    const result = await adaptFixture({ projectPath, provider: 'anthropic', versionTag: 'latest' });

    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toContain('ANTHROPIC_API_KEY=\n');
    await expect(fs.stat(envPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(result.apiKeyWritten).toBe(false);
  });

  it.each(['absent', 'ambiguous'] as const)('skips %s model sites and continues unrelated adjustments', async shape => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const source = await fs.readFile(agentPath, 'utf8');
    const drifted =
      shape === 'absent'
        ? source.replace(/^\s*model:\s*['"]openai\/[^'"]+['"],?\s*$/m, '')
        : `${source}\nconst duplicate = {\n  model: 'openai/extra',\n  defaultOptions: {},\n};\n`;
    await fs.writeFile(agentPath, drifted, 'utf8');

    const result = await adaptFixture({ projectPath, provider: 'google', versionTag: 'latest' });

    expect(await fs.readFile(agentPath, 'utf8')).toBe(drifted);
    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toContain(
      'GOOGLE_GENERATIVE_AI_API_KEY=\n',
    );
    expect((await fs.readFile(path.join(projectPath, 'README.md'), 'utf8')).startsWith('# my-agent\n')).toBe(true);
    expect(result.adaptationFailed).toBe(true);
  });

  it('does not mistake an unrelated model for a missing managed model site', async () => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const source = await fs.readFile(agentPath, 'utf8');
    const drifted = `${source.replace(/^\s*model:\s*['"]openai\/[^'"]+['"],?\s*$/m, '')}\nconst extra = { model: 'openai/extra' };\n`;
    await fs.writeFile(agentPath, drifted, 'utf8');

    const result = await adaptFixture({ projectPath, provider: 'anthropic', versionTag: 'latest' });

    expect(await fs.readFile(agentPath, 'utf8')).toBe(drifted);
    expect(result.adaptationFailed).toBe(true);
  });

  it.each(['absent', 'ambiguous'] as const)(
    'skips %s environment matches, preserves .env, and continues unrelated adjustments',
    async shape => {
      const projectPath = await createFixture();
      const envExamplePath = path.join(projectPath, '.env.example');
      const envPath = path.join(projectPath, '.env');
      const originalEnv = await fs.readFile(envPath, 'utf8');
      const drifted = shape === 'absent' ? 'TURSO_DATABASE_URL=\n' : 'OPENAI_API_KEY=\nOPENAI_API_KEY=\n';
      await fs.writeFile(envExamplePath, drifted, 'utf8');

      const result = await adaptFixture({
        projectPath,
        packageManager: 'pnpm',
        provider: 'anthropic',
        apiKey: TEST_API_KEY,
        versionTag: 'latest',
      });

      expect(await fs.readFile(envExamplePath, 'utf8')).toBe(drifted);
      expect(await fs.readFile(envPath, 'utf8')).toBe(originalEnv);
      expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
      expect(result.adaptationFailed).toBe(true);
      expect(result.apiKeyWritten).toBe(false);
      expectNoSecret(result);
    },
  );

  it.each([
    ['agent models', 'src/mastra/agents/agent.ts', 'anthropic'],
    ['package manifest', 'package.json', 'openai'],
    ['.env.example', '.env.example', 'openai'],
    ['README', 'README.md', 'openai'],
  ] as const)('continues when %s source is missing', async (_label, relativePath, provider) => {
    const projectPath = await createFixture();
    await fs.rm(path.join(projectPath, relativePath));

    const result = await adaptFixture({ projectPath, provider, versionTag: 'latest' });

    expect(result.adaptationFailed).toBe(true);
    if (_label !== 'README')
      expect((await fs.readFile(path.join(projectPath, 'README.md'), 'utf8')).startsWith('# my-agent\n')).toBe(true);
  });

  it('preserves unmatched README wording and records the skipped adjustment', async () => {
    const projectPath = await createFixture();
    const readmePath = path.join(projectPath, 'README.md');
    const customReadme = '# Custom project documentation\n';
    await fs.writeFile(readmePath, customReadme, 'utf8');

    const result = await adaptFixture({ projectPath, provider: 'xai', versionTag: 'latest' });

    expect(await fs.readFile(readmePath, 'utf8')).toBe(customReadme);
    expect(result.adaptationFailed).toBe(true);
    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toContain('XAI_API_KEY=\n');
  });

  it.each([
    ['agent models', 'src/mastra/agents/agent.ts', 'anthropic'],
    ['package manifest', 'package.json', 'openai'],
    ['.env.example', '.env.example', 'openai'],
    ['README', 'README.md', 'openai'],
  ] as const)('continues when %s source is unreadable', async (_label, relativePath, provider) => {
    const projectPath = await createFixture();
    const blockedPath = path.join(projectPath, relativePath);
    const originalReadFile = fs.readFile.bind(fs);
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      if (args[0].toString() === blockedPath) throw new Error('read failed');
      return originalReadFile(...args);
    });

    const result = await adaptFixture({
      projectPath,
      packageManager: 'pnpm',
      provider,
      versionTag: 'latest',
    });

    expect(result.adaptationFailed).toBe(true);
    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
  });

  it('preserves malformed package.json and continues later writes', async () => {
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    await fs.writeFile(manifestPath, '{ not json', 'utf8');

    const result = await adaptFixture({
      projectPath,
      packageManager: 'pnpm',
      provider: 'anthropic',
      versionTag: 'latest',
    });

    expect(await fs.readFile(manifestPath, 'utf8')).toBe('{ not json');
    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
    expect(result.adaptationFailed).toBe(true);
  });

  it('continues later writes after an individual manifest write failure', async () => {
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    const originalWriteFile = fs.writeFile.bind(fs);
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
      if (args[0].toString() === manifestPath) throw new Error('manifest write failed');
      return originalWriteFile(...args);
    });

    const result = await adaptFixture({
      projectPath,
      packageManager: 'pnpm',
      provider: 'anthropic',
      versionTag: 'latest',
    });

    expect(await fs.readFile(path.join(projectPath, '.env.example'), 'utf8')).toContain('ANTHROPIC_API_KEY=\n');
    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
    expect(result.adaptationFailed).toBe(true);
  });

  it('does not publish .env when the .env.example write fails', async () => {
    const projectPath = await createFixture();
    const envExamplePath = path.join(projectPath, '.env.example');
    const envPath = path.join(projectPath, '.env');
    const originalEnv = await fs.readFile(envPath, 'utf8');
    const originalWriteFile = fs.writeFile.bind(fs);
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
      if (args[0].toString() === envExamplePath) throw new Error('env example write failed');
      return originalWriteFile(...args);
    });

    const result = await adaptFixture({
      projectPath,
      provider: 'anthropic',
      apiKey: TEST_API_KEY,
      versionTag: 'latest',
    });

    expect(await fs.readFile(envPath, 'utf8')).toBe(originalEnv);
    expect(result.apiKeyWritten).toBe(false);
    expect(result.adaptationFailed).toBe(true);
    expectNoSecret(result);
  });

  it.each(SECURE_ENV_FAILURES)('preserves .env after a secure temp %s failure', async failure => {
    const projectPath = await createFixture();
    const envPath = path.join(projectPath, '.env');
    const originalEnv = await fs.readFile(envPath, 'utf8');

    if (failure === 'write') {
      const originalWriteFile = fs.writeFile.bind(fs);
      vi.spyOn(fs, 'writeFile').mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
        if (args[0].toString().includes('.env.mastra-create-')) throw new Error('temp write failed');
        return originalWriteFile(...args);
      });
    } else if (failure === 'mode') {
      const originalChmod = fs.chmod.bind(fs);
      vi.spyOn(fs, 'chmod').mockImplementation(async (...args: Parameters<typeof fs.chmod>) => {
        if (args[0].toString().includes('.env.mastra-create-')) throw new Error('chmod failed');
        return originalChmod(...args);
      });
    } else {
      const originalRename = fs.rename.bind(fs);
      vi.spyOn(fs, 'rename').mockImplementation(async (...args: Parameters<typeof fs.rename>) => {
        if (args[0].toString().includes('.env.mastra-create-')) throw new Error('rename failed');
        return originalRename(...args);
      });
    }

    const result = await adaptFixture({
      projectPath,
      provider: 'anthropic',
      apiKey: TEST_API_KEY,
      versionTag: 'latest',
    });

    expect(await fs.readFile(envPath, 'utf8')).toBe(originalEnv);
    expect(result.apiKeyWritten).toBe(false);
    expect(result.adaptationFailed).toBe(true);
    expect((await fs.readdir(projectPath)).filter(file => file.includes('.env.mastra-create-'))).toEqual([]);
    expectNoSecret(result);
  });

  it('does not report the secure temp filename when cleanup fails', async () => {
    const projectPath = await createFixture();
    const envPath = path.join(projectPath, '.env');
    const originalEnv = await fs.readFile(envPath, 'utf8');
    const originalRename = fs.rename.bind(fs);
    const originalRm = fs.rm.bind(fs);
    vi.spyOn(fs, 'rename').mockImplementation(async (...args: Parameters<typeof fs.rename>) => {
      if (args[0].toString().includes('.env.mastra-create-')) throw new Error('rename failed');
      return originalRename(...args);
    });
    vi.spyOn(fs, 'rm').mockImplementation(async (...args: Parameters<typeof fs.rm>) => {
      if (args[0].toString().includes('.env.mastra-create-')) throw new Error('cleanup failed');
      return originalRm(...args);
    });

    const result = await adaptFixture({
      projectPath,
      provider: 'anthropic',
      apiKey: TEST_API_KEY,
      versionTag: 'latest',
    });

    expect(await fs.readFile(envPath, 'utf8')).toBe(originalEnv);
    const tempFile = (await fs.readdir(projectPath)).find(file => file.includes('.env.mastra-create-'));
    expect(tempFile).toBeDefined();
    if (process.platform !== 'win32') {
      expect((await fs.stat(path.join(projectPath, tempFile!))).mode & 0o777).toBe(0o600);
    }
    expect(result).toMatchObject({ apiKeyWritten: false, adaptationFailed: true });
    expect(JSON.stringify(result)).not.toContain(tempFile);
    expect(JSON.stringify(result)).not.toContain(projectPath);
    expectNoSecret(result);
  });

  it('does not reject when built-in web tool assignments are missing', async () => {
    const projectPath = await createFixture();
    const agentPath = path.join(projectPath, 'src/mastra/agents/agent.ts');
    const source = await fs.readFile(agentPath, 'utf8');
    const drifted = source.replace(/^\s*web_(?:fetch|search):.*$/gm, '');
    await fs.writeFile(agentPath, drifted, 'utf8');

    const result = await adaptFixture({ projectPath, provider: 'openai', versionTag: 'latest' });

    expect(await fs.readFile(agentPath, 'utf8')).toBe(drifted);
    expect(result.adaptationFailed).toBe(false);
  });

  it('resolves each Mastra dependency to its independently exact version on success', async () => {
    mockedExeca.mockImplementation(((_cmd: string, args: string[]) => {
      const pkg = args?.[1];
      if (pkg === '@mastra/core') return Promise.resolve({ stdout: '1.55.0-alpha.0\n' }) as never;
      if (pkg === '@mastra/duckdb') return Promise.resolve({ stdout: '1.5.2-alpha.0\n' }) as never;
      if (pkg === '@mastra/libsql') return Promise.resolve({ stdout: '1.18.0-alpha.1\n' }) as never;
      if (pkg === 'mastra') return Promise.resolve({ stdout: '1.21.0-alpha.0\n' }) as never;
      if (pkg === '@mastra/memory') return Promise.resolve({ stdout: '1.24.0-alpha.0\n' }) as never;
      if (pkg === '@mastra/observability') return Promise.resolve({ stdout: '1.16.3-alpha.0\n' }) as never;
      return Promise.reject(new Error('unexpected')) as never;
    }) as never);

    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    await adaptFixture({ projectPath, provider: 'openai', versionTag: 'alpha' });

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(manifest.dependencies['@mastra/core']).toBe('1.55.0-alpha.0');
    expect(manifest.dependencies['@mastra/libsql']).toBe('1.18.0-alpha.1');
    expect(manifest.dependencies['@mastra/duckdb']).toBe('1.5.2-alpha.0');
    expect(manifest.dependencies['@mastra/memory']).toBe('1.24.0-alpha.0');
    expect(manifest.dependencies['@mastra/observability']).toBe('1.16.3-alpha.0');
    expect(manifest.devDependencies.mastra).toBe('1.21.0-alpha.0');
  });

  it('warns once and preserves the channel tag for all Mastra packages on resolution failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    const originalManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    await adaptFixture({ projectPath, provider: 'openai', versionTag: 'snapshot-channel' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    for (const section of [manifest.dependencies, manifest.devDependencies]) {
      for (const [packageName, version] of Object.entries(section)) {
        if (packageName === 'mastra' || packageName.startsWith('@mastra/')) expect(version).toBe('snapshot-channel');
      }
    }
    expect(manifest.dependencies.zod).toBe(originalManifest.dependencies.zod);
  });

  it('performs no resolver lookup and no warning when the manifest has no Mastra packages', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const projectPath = await createFixture();
    const manifestPath = path.join(projectPath, 'package.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    for (const section of ['dependencies', 'devDependencies'] as const) {
      for (const key of Object.keys(manifest[section] ?? {})) {
        if (key === 'mastra' || key.startsWith('@mastra/')) delete manifest[section][key];
      }
    }
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await adaptFixture({ projectPath, provider: 'openai', versionTag: 'latest' });

    expect(mockedExeca).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

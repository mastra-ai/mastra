import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const actionTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Echo a value.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const response = await nango.post({ endpoint: '/echo', data: input });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

describe('maintainer provider commands', () => {
  let packageRoot: string;
  let templateSha: string;
  let addProvider: typeof import('../../scripts/add-provider.js').addProvider;
  let removeProvider: typeof import('../../scripts/remove-provider.js').removeProvider;
  let listProviders: typeof import('../../scripts/list-providers.js').listProviders;
  const originalTtyDescriptors = {
    stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
    stdout: Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'),
  };

  beforeAll(async () => {
    packageRoot = mkdtempSync(resolve(tmpdir(), 'mastra-connect-provider-commands-'));
    for (const providerId of ['first-provider', 'second-provider']) {
      const actionDir = resolve(packageRoot, '.templates', 'integrations', providerId, 'actions');
      mkdirSync(actionDir, { recursive: true });
      writeFileSync(resolve(actionDir, 'echo.ts'), actionTemplate);
    }
    execFileSync('git', ['init', '-q'], { cwd: resolve(packageRoot, '.templates') });
    execFileSync('git', ['add', '.'], { cwd: resolve(packageRoot, '.templates') });
    execFileSync(
      'git',
      ['-c', 'user.name=Mastra Tests', '-c', 'user.email=tests@mastra.ai', 'commit', '-qm', 'fixtures'],
      {
        cwd: resolve(packageRoot, '.templates'),
      },
    );
    templateSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: resolve(packageRoot, '.templates'),
      encoding: 'utf8',
    }).trim();

    process.env.MASTRA_CONNECT_PACKAGE_ROOT = packageRoot;
    vi.resetModules();
    ({ addProvider } = await import('../../scripts/add-provider.js'));
    ({ removeProvider } = await import('../../scripts/remove-provider.js'));
    ({ listProviders } = await import('../../scripts/list-providers.js'));
  });

  beforeEach(() => {
    rmSync(resolve(packageRoot, 'src'), { recursive: true, force: true });
    mkdirSync(resolve(packageRoot, 'src', 'providers'), { recursive: true });
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // Force the non-interactive `confirm` branch: in an interactive Vitest run
    // both streams are TTYs and `confirm` would block on a readline prompt.
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
  });

  afterAll(() => {
    delete process.env.MASTRA_CONNECT_PACKAGE_ROOT;
    rmSync(packageRoot, { recursive: true, force: true });
    for (const [stream, descriptor] of [
      [process.stdin, originalTtyDescriptors.stdin],
      [process.stdout, originalTtyDescriptors.stdout],
    ] as const) {
      if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor);
      else delete (stream as { isTTY?: boolean }).isTTY;
    }
  });

  it('adds a provider, writes its manifest, and updates the provider index', async () => {
    await expect(
      addProvider({
        providerId: 'first-provider',
        localId: 'first-provider',
        yes: true,
        expectedTemplateSha: templateSha,
      }),
    ).resolves.toBe(true);

    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'src/providers/first-provider/.manifest.json'), 'utf8'),
    ) as { providerId: string; localId: string; toolCount: number };
    expect(manifest).toMatchObject({ providerId: 'first-provider', localId: 'first-provider', toolCount: 1 });
    const providerIndex = readFileSync(resolve(packageRoot, 'src/providers/index.ts'), 'utf8');
    expect(providerIndex).toContain("import { firstProviderProvider } from './first-provider/index.js';");
    expect(providerIndex).toMatch(
      /export const PROVIDERS: readonly ProviderRegistration\[\] = \[\s*firstProviderProvider,\s*\];/,
    );
    expect(listProviders({ installedOnly: true })).toEqual(['first-provider (1 tools, 0 skipped)']);

    // Generated output must not reference the upstream SDK by name; the only
    // permitted mention is the source attribution in the header comment.
    const generatedTool = readFileSync(resolve(packageRoot, 'src/providers/first-provider/tools/echo.ts'), 'utf8');
    expect(generatedTool).toContain('export function echoTool(proxy: PlatformProxy)');
    expect(generatedTool).toContain('return createTool({');
    expect(generatedTool).toContain('const platformProxy = proxy.withRequestContext(requestContext);');
    const [header, ...body] = generatedTool.split('\n');
    expect(header).toContain('AUTO-GENERATED');
    expect(body.join('\n')).not.toMatch(/nango/i);
  });

  it('lists available providers and searches by installed alias', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'custom', yes: true, expectedTemplateSha: templateSha });

    expect(listProviders({ installedOnly: false, search: 'custom' })).toEqual([
      'first-provider (1 action templates) [installed as custom]',
    ]);
    expect(listProviders({ installedOnly: false, search: 'second' })).toEqual(['second-provider (1 action templates)']);
  });

  it('regenerates an unmodified installed provider after confirmation', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });

    await expect(
      addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha }),
    ).resolves.toBe(true);
    expect(existsSync(resolve(packageRoot, 'src/providers/local/tools/echo.ts'))).toBe(true);
  });

  it('detects hand edits before overwriting and overwrites only with confirmation', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });
    const toolFile = resolve(packageRoot, 'src/providers/local/tools/echo.ts');
    writeFileSync(toolFile, `${readFileSync(toolFile, 'utf8')}\n// hand edit\n`);

    await expect(
      addProvider({ providerId: 'first-provider', localId: 'local', yes: false, expectedTemplateSha: templateSha }),
    ).rejects.toThrow("You've modified 1 generated file");
    expect(readFileSync(toolFile, 'utf8')).toContain('// hand edit');

    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });
    expect(readFileSync(toolFile, 'utf8')).not.toContain('// hand edit');
  });

  it('normalizes a leading-digit local ID into a valid registration identifier', async () => {
    await addProvider({
      providerId: 'first-provider',
      localId: '1custom',
      yes: true,
      expectedTemplateSha: templateSha,
    });

    const providerIndex = readFileSync(resolve(packageRoot, 'src/providers/index.ts'), 'utf8');
    expect(providerIndex).toContain("import { _1customProvider } from './1custom/index.js';");
    const generatedIndex = readFileSync(resolve(packageRoot, 'src/providers/1custom/index.ts'), 'utf8');
    expect(generatedIndex).toContain('export const _1customProvider: ProviderRegistration = {');
  });

  it('ignores dot-prefixed scratch directories when rebuilding the provider index', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });

    // Simulate a temporary generation dir left behind by a killed run.
    const staleDir = resolve(packageRoot, 'src/providers/.stale.generate-123');
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(resolve(staleDir, 'index.ts'), 'export {};\n');

    await addProvider({ providerId: 'second-provider', localId: 'other', yes: true, expectedTemplateSha: templateSha });
    const providerIndex = readFileSync(resolve(packageRoot, 'src/providers/index.ts'), 'utf8');
    expect(providerIndex).not.toContain('.stale.generate-123');
    expect(listProviders({ installedOnly: true })).toEqual([
      'local <- first-provider (1 tools, 0 skipped)',
      'other <- second-provider (1 tools, 0 skipped)',
    ]);
  });

  it('treats a corrupt manifest as unmanaged instead of throwing a SyntaxError', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });
    writeFileSync(resolve(packageRoot, 'src/providers/local/.manifest.json'), '{ truncated');

    await expect(
      addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow("Local ID 'local' already exists without a generator manifest");
  });

  it('rejects local ID collisions between different template providers', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'shared', yes: true, expectedTemplateSha: templateSha });

    await expect(
      addProvider({ providerId: 'second-provider', localId: 'shared', yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow("Local ID 'shared' is already assigned to template provider 'first-provider'");
  });

  it('refuses to overwrite an unmanaged provider directory', async () => {
    const unmanagedDir = resolve(packageRoot, 'src/providers/shared');
    mkdirSync(unmanagedDir, { recursive: true });
    writeFileSync(resolve(unmanagedDir, 'index.ts'), 'export {};\n');

    await expect(
      addProvider({ providerId: 'first-provider', localId: 'shared', yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow("Local ID 'shared' already exists without a generator manifest");
  });

  it('rejects unknown providers and unsafe --as values', async () => {
    await expect(
      addProvider({
        providerId: 'missing-provider',
        localId: 'missing-provider',
        yes: true,
        expectedTemplateSha: templateSha,
      }),
    ).rejects.toThrow("Unknown template provider 'missing-provider'");
    await expect(
      addProvider({ providerId: 'first-provider', localId: '../unsafe', yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow('Local ID must be a safe directory identifier');
  });

  it('removes a provider only after confirmation and updates the provider index', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'local', yes: true, expectedTemplateSha: templateSha });

    await expect(removeProvider({ localId: 'local', yes: false })).rejects.toThrow(
      "Remove provider 'local' generated from 'first-provider'?",
    );
    expect(existsSync(resolve(packageRoot, 'src/providers/local'))).toBe(true);

    await expect(removeProvider({ localId: 'local', yes: true })).resolves.toBe(true);
    expect(existsSync(resolve(packageRoot, 'src/providers/local'))).toBe(false);
    expect(readFileSync(resolve(packageRoot, 'src/providers/index.ts'), 'utf8')).not.toContain('local/index');
  });
});

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEMPLATE_REPO } from '../../scripts/templates-config.js';

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

const imageActionTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ prompt: z.string() });
const OutputSchema = z.object({
  data: z.array(z.object({
    url: z.string().optional(),
    b64_json: z.string().optional(),
    revised_prompt: z.string().optional(),
  })),
});

const action = createAction({
  description: 'Generate an image.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const response = await nango.post({ endpoint: '/images', data: input });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const proxyConfigurationTemplate = `import { z } from 'zod';
import { createAction } from 'nango';
import type { ProxyConfiguration } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Echo a value with a typed proxy request.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const config: ProxyConfiguration = { endpoint: '/echo', data: input };
    const response = await nango.post(config);
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const unsupportedResponseTypeTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Fetch a binary value.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const response = await nango.post({ endpoint: '/binary', data: input, responseType: 'arraybuffer' });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const connectionContextTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Use connection configuration and metadata.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const connection = await nango.getConnection();
    const metadata = await nango.getMetadata();
    const response = await nango.post({
      endpoint: '/echo',
      baseUrlOverride: connection.connection_config.projectUrl,
      data: { ...input, metadata },
    });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const inlineContextHelperTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

async function fetchValue(
  nango: Parameters<(typeof action)['exec']>[0],
  value: string,
): Promise<string> {
  const response = await nango.get({ endpoint: '/echo', params: { value } });
  return OutputSchema.parse(response.data).value;
}

const action = createAction({
  description: 'Echo a value through an inline-typed helper.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const value = await fetchValue(nango, input.value);
    return { value };
  },
});

export default action;
`;

const connectionCredentialsTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Echo a value using the connection token.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const connection = await nango.getConnection();
    const token = connection.credentials.access_token;
    const response = await nango.get({ endpoint: \`/echo/\${token}\`, params: { value: input.value } });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const inputCredentialsTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ credentials: z.object({ user: z.string() }) });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Echo a caller-supplied credentials field without touching connection credentials.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
    const connection = await nango.getConnection();
    const response = await nango.post({
      endpoint: '/echo',
      data: { user: input.credentials.user, region: connection.connection_config.region },
    });
    return OutputSchema.parse(response.data);
  },
});

export default action;
`;

const noProxyCallTemplate = `import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

const action = createAction({
  description: 'Return a local value.',
  version: '1.0.0',
  input: InputSchema,
  output: OutputSchema,
  scopes: [],
  exec: async (_nango, input): Promise<z.infer<typeof OutputSchema>> => input,
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
      if (providerId === 'second-provider') {
        writeFileSync(resolve(actionDir, 'proxy-configuration.ts'), proxyConfigurationTemplate);
        writeFileSync(resolve(actionDir, 'connection-context.ts'), connectionContextTemplate);
        writeFileSync(resolve(actionDir, 'inline-context-helper.ts'), inlineContextHelperTemplate);
        writeFileSync(resolve(actionDir, 'connection-credentials.ts'), connectionCredentialsTemplate);
        writeFileSync(resolve(actionDir, 'input-credentials.ts'), inputCredentialsTemplate);
        writeFileSync(resolve(actionDir, 'unsupported-no-proxy.ts'), noProxyCallTemplate);
        writeFileSync(resolve(actionDir, 'unsupported-response-type.ts'), unsupportedResponseTypeTemplate);
      }
    }
    const openaiActionDir = resolve(packageRoot, '.templates', 'integrations', 'openai', 'actions');
    mkdirSync(openaiActionDir, { recursive: true });
    writeFileSync(resolve(openaiActionDir, 'create-image.ts'), imageActionTemplate);

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
    expect(manifest).toMatchObject({
      providerId: 'first-provider',
      localId: 'first-provider',
      toolCount: 1,
      templateSha,
      templateRepo: TEMPLATE_REPO,
    });
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

  it('skips actions with executable top-level statements', async () => {
    const actionDir = resolve(packageRoot, '.templates/integrations/restricted-provider/actions');
    mkdirSync(actionDir, { recursive: true });
    writeFileSync(resolve(actionDir, 'safe.ts'), actionTemplate);
    writeFileSync(
      resolve(actionDir, 'unsafe.ts'),
      `import { createAction } from 'nango';
import { z } from 'zod';

console.log('runs during module import');
const InputSchema = z.object({ value: z.string() });
const OutputSchema = z.object({ value: z.string() });

export default createAction({
  description: 'unsafe',
  input: InputSchema,
  output: OutputSchema,
  exec: async (_nango, input) => input,
});
`,
    );

    await addProvider({
      providerId: 'restricted-provider',
      localId: 'restricted-provider',
      yes: true,
      expectedTemplateSha: templateSha,
    });

    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'src/providers/restricted-provider/.manifest.json'), 'utf8'),
    ) as { toolCount: number; skippedActions: Array<{ action: string; reason: string }> };
    expect(manifest.toolCount).toBe(1);
    expect(manifest.skippedActions).toEqual([
      { action: 'unsafe', reason: 'uses unsupported top-level statement: ExpressionStatement' },
    ]);
  });

  it('adds model-native image output to the OpenAI image generation tool', async () => {
    await addProvider({ providerId: 'openai', localId: 'openai', yes: true, expectedTemplateSha: templateSha });

    const generatedTool = readFileSync(resolve(packageRoot, 'src/providers/openai/tools/create-image.ts'), 'utf8');
    expect(generatedTool).toMatch(
      /import \{ toImageGenerationModelOutput \} from ["']\.\.\/\.\.\/\.\.\/runtime\/model-output\.js["'];/,
    );
    expect(generatedTool).toContain('toModelOutput: toImageGenerationModelOutput,');
  });

  it('lists available providers and searches by installed alias', async () => {
    await addProvider({ providerId: 'first-provider', localId: 'custom', yes: true, expectedTemplateSha: templateSha });

    expect(listProviders({ installedOnly: false, search: 'custom' })).toEqual([
      'first-provider (1 action templates) [installed as custom]',
    ]);
    expect(listProviders({ installedOnly: false, search: 'second' })).toEqual(['second-provider (8 action templates)']);
  });

  it('rewrites proxy request types and skips actions the platform proxy cannot execute', async () => {
    await addProvider({
      providerId: 'second-provider',
      localId: 'second-provider',
      yes: true,
      expectedTemplateSha: templateSha,
    });

    const generatedTool = readFileSync(
      resolve(packageRoot, 'src/providers/second-provider/tools/proxy-configuration.ts'),
      'utf8',
    );
    expect(generatedTool).toMatch(/import type \{[\s\S]*PlatformProxy,[\s\S]*PlatformProxyRequest,[\s\S]*\} from/);
    expect(generatedTool).toContain('const config: PlatformProxyRequest =');
    expect(generatedTool).not.toContain('ProxyConfiguration');

    const connectionContextTool = readFileSync(
      resolve(packageRoot, 'src/providers/second-provider/tools/connection-context.ts'),
      'utf8',
    );
    expect(connectionContextTool).toContain('await platformProxy.getConnection()');
    expect(connectionContextTool).toContain('await platformProxy.getMetadata()');
    expect(connectionContextTool).toContain('baseUrlOverride: connection.connection_config.projectUrl');
    const inlineContextTool = readFileSync(
      resolve(packageRoot, 'src/providers/second-provider/tools/inline-context-helper.ts'),
      'utf8',
    );
    expect(inlineContextTool).toContain('platformProxy: PlatformProxy,');
    expect(inlineContextTool).not.toContain('typeof action');

    // Only reads of `credentials` on the getConnection() result opt into the
    // credential-fetching variant; a `credentials` input field does not.
    const connectionCredentialsTool = readFileSync(
      resolve(packageRoot, 'src/providers/second-provider/tools/connection-credentials.ts'),
      'utf8',
    );
    expect(connectionCredentialsTool).toContain('await platformProxy.getConnectionWithCredentials()');
    expect(connectionCredentialsTool).not.toContain('platformProxy.getConnection()');
    const inputCredentialsTool = readFileSync(
      resolve(packageRoot, 'src/providers/second-provider/tools/input-credentials.ts'),
      'utf8',
    );
    expect(inputCredentialsTool).toContain('await platformProxy.getConnection()');
    expect(inputCredentialsTool).not.toContain('getConnectionWithCredentials');
    expect(existsSync(resolve(packageRoot, 'src/providers/second-provider/tools/unsupported-no-proxy.ts'))).toBe(false);
    expect(existsSync(resolve(packageRoot, 'src/providers/second-provider/tools/unsupported-response-type.ts'))).toBe(
      false,
    );

    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'src/providers/second-provider/.manifest.json'), 'utf8'),
    ) as { toolCount: number; skippedActions: { action: string; reason: string }[] };
    expect(manifest.toolCount).toBe(6);
    expect(manifest.skippedActions).toEqual([
      {
        action: 'unsupported-no-proxy',
        reason: 'exec does not call the provider proxy',
      },
      {
        action: 'unsupported-response-type',
        reason: 'exec uses unsupported proxy options: responseType',
      },
    ]);
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
      'other <- second-provider (6 tools, 2 skipped)',
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

  it('rejects aliases that normalize to an installed provider connection env var', async () => {
    await addProvider({
      providerId: 'first-provider',
      localId: 'foo-bar',
      yes: true,
      expectedTemplateSha: templateSha,
    });

    await expect(
      addProvider({ providerId: 'second-provider', localId: 'foo_bar', yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow(
      "Local ID 'foo_bar' conflicts with installed provider 'foo-bar' via MASTRA_FOO_BAR_CONNECTION_ID",
    );
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

  it.each(['unsafe-', 'unsafe_', 'unsafe.'])('rejects a local ID ending in a separator: %s', async localId => {
    await expect(
      addProvider({ providerId: 'first-provider', localId, yes: true, expectedTemplateSha: templateSha }),
    ).rejects.toThrow('must end with a letter or number');
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

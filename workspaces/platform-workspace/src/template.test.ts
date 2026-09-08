import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { serializeSandboxTemplate } from './template.js';
import * as platformWorkspace from './index.js';
import { Template, type SandboxTemplateBuilder, type SerializedSandboxTemplate } from './index.js';

describe('Template', () => {
  it('serializes the supported E2B-shaped operations in order', () => {
    const definition = serializeSandboxTemplate(
      Template()
        .cpuCount(4)
        .memoryMB(8_192)
        .setEnvs({ GH_TOKEN: 'ghs_build_only' }, { ephemeral: true })
        .setWorkdir('/workspace/repo')
        .setEnvs({ CI: '1', EMPTY: '' })
        .aptInstall(['git', 'jq'], { noInstallRecommends: true })
        .pipInstall('ruff', { g: false })
        .npmInstall(['typescript', 'tsx'], { dev: true })
        .runCmd(['pnpm install', 'pnpm build']),
    );

    expect(definition).toEqual({
      schemaVersion: 1,
      operations: [
        { method: 'cpuCount', args: [4] },
        { method: 'memoryMB', args: [8_192] },
        { method: 'setWorkdir', args: ['/workspace/repo'] },
        { method: 'setEnvs', args: [{ CI: '1', EMPTY: '' }] },
        { method: 'aptInstall', args: [['git', 'jq'], { noInstallRecommends: true }] },
        { method: 'pipInstall', args: ['ruff', { g: false }] },
        { method: 'npmInstall', args: [['typescript', 'tsx'], { dev: true }] },
        { method: 'runCmd', args: [['pnpm install', 'pnpm build']] },
      ],
    });
    expect(definition).not.toHaveProperty('provider');
    expect(JSON.stringify(definition)).not.toContain('ghs_build_only');
  });

  it('preserves E2B optional install argument positions', () => {
    expect(serializeSandboxTemplate(Template().pipInstall().npmInstall(undefined, { g: true })).operations).toEqual([
      { method: 'pipInstall', args: [] },
      { method: 'npmInstall', args: [null, { g: true }] },
    ]);
  });

  it('returns a new immutable builder for every operation', () => {
    const envs = { MODE: 'build' };
    const base = Template().setEnvs(envs);
    const extended = base.runCmd('pnpm build');
    envs.MODE = 'mutated';

    const first = serializeSandboxTemplate(base);
    const second = serializeSandboxTemplate(extended);
    expect(first.operations).toEqual([{ method: 'setEnvs', args: [{ MODE: 'build' }] }]);
    expect(second.operations).toHaveLength(2);

    (first.operations[0]!.args[0] as Record<string, string>).MODE = 'changed again';
    expect(serializeSandboxTemplate(base).operations).toEqual([{ method: 'setEnvs', args: [{ MODE: 'build' }] }]);
  });

  it.each([
    () => Template().runCmd(''),
    () => Template().runCmd([]),
    () => Template().runCmd(['ok', '']),
    () => Template().setWorkdir(''),
    () => Template().cpuCount(0),
    () => Template().cpuCount(1.5),
    () => Template().cpuCount(Number.MAX_SAFE_INTEGER + 1),
    () => Template().memoryMB(0),
    () => Template().memoryMB(Number.NaN),
    () => Template().memoryMB(Number.MAX_SAFE_INTEGER + 1),
    () => Template().aptInstall([]),
    () => Template().setEnvs({ '': 'value' }),
    () => Template().setEnvs(new Date() as unknown as Record<string, string>),
    () => Template().setEnvs({ TOKEN: 'value' }, { ephemeral: 'yes' } as never),
    () => Template().setEnvs({ TOKEN: 'value' }, { other: true } as never),
    () => Template().aptInstall('git', { noInstallRecommends: 'yes' } as never),
    () => Template().npmInstall('tsx', { other: true } as never),
  ])('rejects invalid operation arguments', build => {
    expect(build).toThrow();
  });

  it('accepts positive safe integer resource values', () => {
    expect(serializeSandboxTemplate(Template().cpuCount(33).memoryMB(65_537)).operations).toEqual([
      { method: 'cpuCount', args: [33] },
      { method: 'memoryMB', args: [65_537] },
    ]);
  });

  it('rejects sparse arrays for every command and package operation', () => {
    const sparse = new Array<string>(1);

    expect(() => Template().runCmd(sparse)).toThrow(/command\[0\] must be a string/);
    expect(() => Template().aptInstall(sparse)).toThrow(/packages\[0\] must be a string/);
    expect(() => Template().pipInstall(sparse)).toThrow(/packages\[0\] must be a string/);
    expect(() => Template().npmInstall(sparse)).toThrow(/packages\[0\] must be a string/);
  });

  it('rejects caller-cast non-JSON values before serialization', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(() => Template().setEnvs({ VALUE: Number.NaN as never })).toThrow(/must be a string/);
    expect(() => Template().setEnvs({ VALUE: cycle as never })).toThrow(/must be a string/);
  });

  it('enforces exact string and collection boundaries', () => {
    const maximumString = 'x'.repeat(32 * 1024);
    expect(serializeSandboxTemplate(Template().runCmd(maximumString)).operations[0]!.args[0]).toBe(maximumString);
    expect(() => Template().runCmd(`${maximumString}x`)).toThrow(/32768 characters/);

    const maximumPackages = new Array(512).fill('package');
    expect(serializeSandboxTemplate(Template().aptInstall(maximumPackages)).operations[0]!.args[0]).toHaveLength(512);
    expect(() => Template().aptInstall([...maximumPackages, 'one-too-many'])).toThrow(/512 items/);

    const maximumEnvs = Object.fromEntries(Array.from({ length: 512 }, (_, index) => [`KEY_${index}`, 'value']));
    expect(
      Object.keys(serializeSandboxTemplate(Template().setEnvs(maximumEnvs)).operations[0]!.args[0] as object),
    ).toHaveLength(512);
    expect(() => Template().setEnvs({ ...maximumEnvs, ONE_TOO_MANY: 'value' })).toThrow(/512 items/);
  });

  it('enforces operation and serialized-size limits independently', () => {
    let builder = Template();
    for (let index = 0; index < 256; index++) builder = builder.runCmd(`echo ${index}`);
    expect(() => builder.runCmd('one too many')).toThrow(/256 operations/);

    let large = Template();
    const validMaximumCommand = 'x'.repeat(32 * 1024);
    expect(() => {
      for (let index = 0; index < 9; index++) large = large.runCmd(validMaximumCommand);
    }).toThrow(/262144 bytes/);
  });

  it('includes the family key in the serialized-size limit', () => {
    const maximumCommand = 'x'.repeat(32 * 1024);
    const maximumFamily = 'f'.repeat(200);

    let withoutFamily = Template();
    for (let index = 0; index < 7; index++) withoutFamily = withoutFamily.runCmd(maximumCommand);
    withoutFamily = withoutFamily.runCmd('x'.repeat(32_267));
    expect(() => withoutFamily.withFamily(maximumFamily)).toThrow(/262144 bytes/);

    let withFamily = Template();
    for (let index = 0; index < 7; index++) withFamily = withFamily.runCmd(maximumCommand);
    withFamily = withFamily.runCmd('x'.repeat(32_234)).withFamily(maximumFamily);
    expect(() => withFamily.runCmd('x')).toThrow(/262144 bytes/);
  });

  it('starts an eager provider build without putting ephemeral envs in the definition', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'pending', templateId: 'tpl_123', retryAfterMs: 5_000 }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await Template()
      .setEnvs({ GH_TOKEN: 'ghs_expired' }, { ephemeral: true })
      .setEnvs({ GH_TOKEN: 'ghs_build_only' }, { ephemeral: true })
      .runCmd('pnpm install')
      .build({
        accessToken: 'sk_test',
        projectId: 'proj_123',
        environmentId: 'env_123',
        sandboxProvider: 'e2b',
        fetch: fetchMock,
      });

    expect(result).toEqual({ status: 'pending', templateId: 'tpl_123', retryAfterMs: 5_000 });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/e2b/projects/proj_123/sandbox/templates/builds',
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual({
      environmentId: 'env_123',
      templateDefinition: {
        schemaVersion: 1,
        operations: [{ method: 'runCmd', args: ['pnpm install'] }],
      },
      templateBuildEnvs: { GH_TOKEN: 'ghs_build_only' },
    });
  });

  it('exposes only fluent template methods on the public builder type', () => {
    expect(platformWorkspace.Template).toBe(Template);
    expect(platformWorkspace).not.toHaveProperty('PlatformTemplateClient');
    expectTypeOf(Template).parameters.toEqualTypeOf<[]>();
    expectTypeOf(Template()).toEqualTypeOf<SandboxTemplateBuilder>();
    expectTypeOf(serializeSandboxTemplate(Template())).toEqualTypeOf<SerializedSandboxTemplate>();

    type Keys = keyof SandboxTemplateBuilder;
    type HasPublicTemplateClient = 'PlatformTemplateClient' extends keyof typeof platformWorkspace ? true : false;
    expectTypeOf<Keys>().toEqualTypeOf<
      | 'cpuCount'
      | 'memoryMB'
      | 'build'
      | 'runCmd'
      | 'setWorkdir'
      | 'setEnvs'
      | 'aptInstall'
      | 'pipInstall'
      | 'npmInstall'
      | 'withFamily'
    >();
    expectTypeOf<HasPublicTemplateClient>().toEqualTypeOf<false>();
  });

  it('round-trips a family key through withFamily', () => {
    const definition = serializeSandboxTemplate(
      Template().runCmd('pnpm install').withFamily('repo:acme/widgets:$HOME/widgets'),
    );
    expect(definition.family).toBe('repo:acme/widgets:$HOME/widgets');
  });

  it('rejects an empty or oversized family key', () => {
    expect(() => Template().withFamily('')).toThrow();
    expect(() => Template().withFamily('x'.repeat(201))).toThrow();
  });

  it('family key survives subsequent builder operations', () => {
    const definition = serializeSandboxTemplate(
      Template().withFamily('repo:acme/widgets:/w').runCmd('pnpm install').setWorkdir('/w'),
    );
    expect(definition.family).toBe('repo:acme/widgets:/w');
  });
});

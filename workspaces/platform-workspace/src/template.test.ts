import { describe, expect, expectTypeOf, it } from 'vitest';
import { createSandboxTemplate, serializeSandboxTemplate } from './template.js';
import * as platformWorkspace from './index.js';
import { Template, type SandboxTemplateBuilder, type SerializedSandboxTemplate } from './index.js';

describe('Template', () => {
  it('serializes the supported E2B-shaped operations in order', () => {
    const definition = serializeSandboxTemplate(
      Template()
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
        { method: 'setWorkdir', args: ['/workspace/repo'] },
        { method: 'setEnvs', args: [{ CI: '1', EMPTY: '' }] },
        { method: 'aptInstall', args: [['git', 'jq'], { noInstallRecommends: true }] },
        { method: 'pipInstall', args: ['ruff', { g: false }] },
        { method: 'npmInstall', args: [['typescript', 'tsx'], { dev: true }] },
        { method: 'runCmd', args: [['pnpm install', 'pnpm build']] },
      ],
    });
    expect(definition).not.toHaveProperty('provider');
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

  it('derives a deterministic SHA-256 identity from the canonical definition', () => {
    const first = Template().setEnvs({ ZED: 'last', ALPHA: 'first' }).runCmd('pnpm build');
    const sameDefinition = Template().setEnvs({ ALPHA: 'first', ZED: 'last' }).runCmd('pnpm build');
    const differentOrder = Template().runCmd('pnpm build').setEnvs({ ALPHA: 'first', ZED: 'last' });

    expect(first.id()).toBe('6c6cbd6b21036a4ed72be2d63ae2674437670d6e927adebd8e9389fb63019a39');
    expect(first.id()).toBe(sameDefinition.id());
    expect(first.id()).not.toBe(differentOrder.id());
  });

  it('keeps stale-while-revalidate policy out of repository template identity', () => {
    const source = {
      type: 'git' as const,
      familyId: 'a'.repeat(64),
      commitSha: '1'.repeat(40),
    };
    const exact = createSandboxTemplate(source).runCmd('pnpm install');
    const explicitFalse = createSandboxTemplate({ ...source, staleWhileRevalidate: false }).runCmd('pnpm install');
    const stale = createSandboxTemplate({ ...source, staleWhileRevalidate: true }).runCmd('pnpm install');

    expect(explicitFalse.id()).toBe(exact.id());
    expect(stale.id()).toBe(exact.id());
  });

  it.each([
    () => Template().runCmd(''),
    () => Template().runCmd([]),
    () => Template().runCmd(['ok', '']),
    () => Template().setWorkdir(''),
    () => Template().aptInstall([]),
    () => Template().setEnvs({ '': 'value' }),
    () => Template().setEnvs(new Date() as unknown as Record<string, string>),
    () => Template().aptInstall('git', { noInstallRecommends: 'yes' } as never),
    () => Template().npmInstall('tsx', { other: true } as never),
  ])('rejects invalid operation arguments', build => {
    expect(build).toThrow();
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

  it('exposes only fluent template methods on the public builder type', () => {
    expect(platformWorkspace.Template).toBe(Template);
    expect(platformWorkspace).not.toHaveProperty('PlatformTemplateClient');
    expectTypeOf(Template).parameters.toEqualTypeOf<[]>();
    expectTypeOf(Template()).toEqualTypeOf<SandboxTemplateBuilder>();
    expectTypeOf(serializeSandboxTemplate(Template())).toEqualTypeOf<SerializedSandboxTemplate>();

    type Keys = keyof SandboxTemplateBuilder;
    type HasPublicTemplateClient = 'PlatformTemplateClient' extends keyof typeof platformWorkspace ? true : false;
    expectTypeOf<Keys>().toEqualTypeOf<
      'id' | 'runCmd' | 'setWorkdir' | 'setEnvs' | 'aptInstall' | 'pipInstall' | 'npmInstall'
    >();
    expectTypeOf<HasPublicTemplateClient>().toEqualTypeOf<false>();
  });
});

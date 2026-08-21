import { describe, expect, expectTypeOf, it } from 'vitest';
import { Template, type SandboxTemplateBuilder, type SerializedSandboxTemplate } from './template';

describe('Template', () => {
  it('serializes the supported E2B-shaped operations in order', () => {
    const definition = Template()
      .setWorkdir('/workspace/repo')
      .setEnvs({ CI: '1', EMPTY: '' })
      .aptInstall(['git', 'jq'], { noInstallRecommends: true })
      .pipInstall('ruff', { g: false })
      .npmInstall(['typescript', 'tsx'], { dev: true })
      .runCmd(['pnpm install', 'pnpm build'])
      .toJSON();

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
    expect(Template().pipInstall().npmInstall(undefined, { g: true }).toJSON().operations).toEqual([
      { method: 'pipInstall', args: [] },
      { method: 'npmInstall', args: [null, { g: true }] },
    ]);
  });

  it('returns a new immutable builder for every operation', () => {
    const envs = { MODE: 'build' };
    const base = Template().setEnvs(envs);
    const extended = base.runCmd('pnpm build');
    envs.MODE = 'mutated';

    const first = base.toJSON();
    const second = extended.toJSON();
    expect(first.operations).toEqual([{ method: 'setEnvs', args: [{ MODE: 'build' }] }]);
    expect(second.operations).toHaveLength(2);

    (first.operations[0]!.args[0] as Record<string, string>).MODE = 'changed again';
    expect(base.toJSON().operations).toEqual([{ method: 'setEnvs', args: [{ MODE: 'build' }] }]);
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
    expect(Template().runCmd(maximumString).toJSON().operations[0]!.args[0]).toBe(maximumString);
    expect(() => Template().runCmd(`${maximumString}x`)).toThrow(/32768 characters/);

    const maximumPackages = new Array(512).fill('package');
    expect(Template().aptInstall(maximumPackages).toJSON().operations[0]!.args[0]).toHaveLength(512);
    expect(() => Template().aptInstall([...maximumPackages, 'one-too-many'])).toThrow(/512 items/);

    const maximumEnvs = Object.fromEntries(Array.from({ length: 512 }, (_, index) => [`KEY_${index}`, 'value']));
    expect(Object.keys(Template().setEnvs(maximumEnvs).toJSON().operations[0]!.args[0] as object)).toHaveLength(512);
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

  it('exposes the intended public builder type', () => {
    expectTypeOf(Template).parameters.toEqualTypeOf<[]>();
    expectTypeOf(Template()).toEqualTypeOf<SandboxTemplateBuilder>();
    expectTypeOf(Template().toJSON()).toEqualTypeOf<SerializedSandboxTemplate>();

    type Keys = keyof SandboxTemplateBuilder;
    expectTypeOf<Keys>().toEqualTypeOf<
      'runCmd' | 'setWorkdir' | 'setEnvs' | 'aptInstall' | 'pipInstall' | 'npmInstall' | 'toJSON'
    >();
  });
});

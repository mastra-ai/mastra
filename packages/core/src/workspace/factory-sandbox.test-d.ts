import { describe, expectTypeOf, it } from 'vitest';
import type { FactorySandbox, FactorySandboxContext } from './factory-sandbox';
import type { MastraSandbox } from './sandbox/mastra-sandbox';

describe('FactorySandbox types', () => {
  it('create returns a MastraSandbox synchronously', () => {
    type Create = FactorySandbox['create'];
    expectTypeOf<ReturnType<Create>>().toEqualTypeOf<MastraSandbox>();
    expectTypeOf<ReturnType<Create>>().not.toMatchTypeOf<Promise<unknown>>();
    expectTypeOf<Parameters<Create>[0]>().toEqualTypeOf<FactorySandboxContext>();
  });

  it('template and builds are optional', () => {
    expectTypeOf<FactorySandbox['template']>().toEqualTypeOf<
      ((ctx: FactorySandboxContext, settings: Record<string, unknown>) => unknown) | undefined
    >();
    expectTypeOf<FactorySandbox['builds']>().extract<undefined>().toEqualTypeOf<undefined>();
  });
});

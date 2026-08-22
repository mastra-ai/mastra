import type { TemplateBuilder as E2BTemplateBuilder } from 'e2b';
import { describe, expect, it } from 'vitest';
import { Template, type SandboxTemplateBuilder } from './template.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type Expect<Value extends true> = Value;

type RunCmdCommandMatchesE2B = Expect<
  Equal<Parameters<SandboxTemplateBuilder['runCmd']>[0], Parameters<E2BTemplateBuilder['runCmd']>[0]>
>;
type RunCmdDeliberatelyExcludesUserOption = Expect<
  Equal<Parameters<SandboxTemplateBuilder['runCmd']>, [command: string | string[]]>
>;
type SetWorkdirAcceptsE2BStringPath = Expect<
  Parameters<SandboxTemplateBuilder['setWorkdir']>[0] extends Parameters<E2BTemplateBuilder['setWorkdir']>[0]
    ? true
    : false
>;
type SetEnvsMatchesE2B = Expect<
  Equal<Parameters<SandboxTemplateBuilder['setEnvs']>, Parameters<E2BTemplateBuilder['setEnvs']>>
>;
type AptInstallMatchesE2B = Expect<
  Equal<Parameters<SandboxTemplateBuilder['aptInstall']>, Parameters<E2BTemplateBuilder['aptInstall']>>
>;
type PipInstallMatchesE2B = Expect<
  Equal<Parameters<SandboxTemplateBuilder['pipInstall']>, Parameters<E2BTemplateBuilder['pipInstall']>>
>;
type NpmInstallMatchesE2B = Expect<
  Equal<Parameters<SandboxTemplateBuilder['npmInstall']>, Parameters<E2BTemplateBuilder['npmInstall']>>
>;

type E2BTemplateCompatibilityAssertions =
  | RunCmdCommandMatchesE2B
  | RunCmdDeliberatelyExcludesUserOption
  | SetWorkdirAcceptsE2BStringPath
  | SetEnvsMatchesE2B
  | AptInstallMatchesE2B
  | PipInstallMatchesE2B
  | NpmInstallMatchesE2B;

describe('E2B template signature compatibility', () => {
  it('keeps the supported serializable subset structurally compatible', () => {
    expect(true satisfies E2BTemplateCompatibilityAssertions).toBe(true);
  });

  it('deliberately excludes non-portable E2B options and methods', () => {
    const assertExcludedOperations = () => {
      // @ts-expect-error The E2B user option isn't portable to Railway in protocol v1.
      Template().runCmd('whoami', { user: 'root' });
      // @ts-expect-error Local filesystem copies aren't JSON-portable build operations.
      Template().copy('package.json', '/workspace/package.json');
    };

    expect(assertExcludedOperations).toBeTypeOf('function');
  });
});

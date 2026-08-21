import { describe, expect, it, vi } from 'vitest';

import { repoTemplateAlias } from './repo-template';
import { e2bSessionSandbox } from './session-sandbox';
import { isNamedTemplateSpec } from './template';

describe('e2bSessionSandbox', () => {
  it('constructs an E2BSandbox keyed by the session id with a sha-aliased repo template', () => {
    const create = e2bSessionSandbox();
    const sandbox = create({
      sessionId: 'session-1',
      repoFullName: 'octocat/hello',
      repoSha: 'a'.repeat(40),
      setupCommand: 'pnpm install',
    });

    expect(sandbox.id).toBe('session-1');
    const template = (sandbox as unknown as { templateSpec?: unknown }).templateSpec;
    expect(isNamedTemplateSpec(template)).toBe(true);
    expect((template as { alias: string }).alias).toBe(
      repoTemplateAlias({ repoFullName: 'octocat/hello', sha: 'a'.repeat(40), setupCommand: 'pnpm install' }),
    );
  });

  it('omits the template for sessions without a repo', () => {
    const sandbox = e2bSessionSandbox()({ sessionId: 'session-2' });
    expect((sandbox as unknown as { templateSpec?: unknown }).templateSpec).toBeUndefined();
  });

  it('forwards the host onStart hook and honors the idle timeout override', async () => {
    const onStart = vi.fn(async () => {});
    const sandbox = e2bSessionSandbox({ idleTimeoutMinutes: 60 })({ sessionId: 'session-3', onStart });
    expect((sandbox as unknown as { timeout: number }).timeout).toBe(60 * 60_000);
    // The hook is wired into the start lifecycle (captured at construction).
    expect((sandbox as unknown as { _onStart?: unknown })._onStart).toBe(onStart);
  });

  it('uses a template override verbatim instead of deriving one', () => {
    const sandbox = e2bSessionSandbox({ template: 'my-prebuilt-template' })({
      sessionId: 'session-4',
      repoFullName: 'octocat/hello',
    });
    expect((sandbox as unknown as { templateSpec?: unknown }).templateSpec).toBe('my-prebuilt-template');
  });
});

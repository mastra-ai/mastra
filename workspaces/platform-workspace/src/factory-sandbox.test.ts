import { describeFactorySandbox, isFactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { PlatformFactorySandbox } from './factory-sandbox.js';
import { createRepoTemplate } from './repo-template.js';
import { PlatformSandbox } from './sandbox.js';
import { getSandboxTemplateBuildEnvs, serializeSandboxTemplate } from './template.js';

const SHA_1 = '0123456789abcdef0123456789abcdef01234567';
const SHA_2 = 'fedcba9876543210fedcba9876543210fedcba98';

const heads: Record<string, string> = {
  'https://github.com/acme/app': SHA_1,
  'https://github.com/acme/shared-ui': SHA_2,
};

function listContext(): FactorySandboxContext {
  return {
    sessionId: 'sess_1',
    sandboxId: 'sbx_prev',
    getRepositoryAccess: undefined,
    repos: [
      {
        getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
        setupCommand: 'pnpm install',
      },
      {
        getRepositoryAccess: async () => ({
          cloneUrl: 'https://github.com/acme/shared-ui.git',
          authorization: { scheme: 'bearer', token: 'ghs_secret' },
        }),
      },
    ],
    workspaceSetupCommand: 'pnpm link ../shared-ui',
    workingDirectory: '/home/user/repos',
    continueOnSetupFailure: true,
    resolveHead: vi.fn(async (cloneUrl: string) => heads[cloneUrl]),
  };
}

function singleContext(): FactorySandboxContext {
  return {
    sessionId: 'sess_2',
    getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
    setupCommand: 'pnpm install',
    resolveHead: vi.fn(async (cloneUrl: string) => heads[cloneUrl]),
  };
}

async function identity(resolver: ReturnType<typeof createRepoTemplate>) {
  const template = await resolver!();
  return { definition: serializeSandboxTemplate(template!), buildEnvs: getSandboxTemplateBuildEnvs(template!) };
}

describe('PlatformFactorySandbox', () => {
  it('is a branded FactorySandbox describing cpu, memory and idle timeout', () => {
    const sandbox = new PlatformFactorySandbox({ accessToken: 'sk_test', projectId: 'proj_1' });
    expect(isFactorySandbox(sandbox)).toBe(true);
    const description = describeFactorySandbox(sandbox);
    expect(description.provider).toBe('platform');
    expect(Object.keys(description.settingsSchema.properties ?? {})).toEqual([
      'cpuCount',
      'memoryMb',
      'idleTimeoutMinutes',
    ]);
    expect(description.capabilities).toEqual({ template: true, builds: { available: true, history: false } });
  });

  it('builds the web host callback template sized by the 2 CPU / 1024 MB defaults', async () => {
    for (const ctx of [listContext(), singleContext()]) {
      const callback = await identity(createRepoTemplate({ ...ctx, cpuCount: 2, memoryMB: 1024 }));
      const viaClass = await identity(new PlatformFactorySandbox({}).template(ctx, {}));
      expect(viaClass.definition).toEqual(callback.definition);
      expect(viaClass.buildEnvs).toEqual(callback.buildEnvs);
    }
  });

  it('builds the same template as the shipyard callback through defaults and buildEnv', async () => {
    const buildEnv = { TURBO_TOKEN: 'tok', TURBO_TEAM: 'team' };
    const ctx = listContext();
    const callback = await identity(createRepoTemplate({ ...ctx, buildEnv, memoryMB: 8192, cpuCount: 4 }));
    const viaClass = await identity(
      new PlatformFactorySandbox({ template: { buildEnv }, defaults: { cpuCount: 4, memoryMb: 8192 } }).template(
        ctx,
        {},
      ),
    );
    expect(viaClass.definition).toEqual(callback.definition);
    expect(viaClass.buildEnvs).toEqual(callback.buildEnvs);
    expect(viaClass.buildEnvs).toMatchObject(buildEnv);
  });

  it('a setting wins over the provider default and changes the template', async () => {
    const ctx = listContext();
    const sandbox = new PlatformFactorySandbox({ defaults: { cpuCount: 4, memoryMb: 8192 } });
    const withDefaults = await identity(sandbox.template(ctx, {}));
    const withSetting = await identity(sandbox.template(ctx, { cpuCount: 2 }));
    const explicit = await identity(createRepoTemplate({ ...ctx, cpuCount: 2, memoryMB: 8192 }));
    expect(withSetting.definition).toEqual(explicit.definition);
    expect(withSetting.definition).not.toEqual(withDefaults.definition);
  });

  it('returns a resources-only template for a session without repositories', async () => {
    const sandbox = new PlatformFactorySandbox({});
    const ctx = { sessionId: 's', getRepositoryAccess: undefined };
    const viaClass = await identity(sandbox.template(ctx, {}));
    const direct = await identity(createRepoTemplate({ ...ctx, cpuCount: 2, memoryMB: 1024 }));
    expect(viaClass.definition).toEqual(direct.definition);
  });

  it('creates a PlatformSandbox keyed by the session with the client options and idle timeout', () => {
    const sandbox = new PlatformFactorySandbox({
      accessToken: 'sk_test',
      projectId: 'proj_1',
      env: { FOO: 'bar' },
      defaults: { idleTimeoutMinutes: 30 },
    });
    const ctx = listContext();
    const created = sandbox.create(ctx, {});
    expect(created).toBeInstanceOf(PlatformSandbox);
    expect(created.id).toBe('sess_1');
    expect((created as any)._idleTimeoutMinutes).toBe(30);
    expect((created as any)._client.sessionId).toBe('sess_1');
    expect((created as any)._sandboxId).toBe('sbx_prev');
    expect(typeof (created as any)._template).toBe('function');

    const tuned = sandbox.create(ctx, { idleTimeoutMinutes: 5 });
    expect((tuned as any)._idleTimeoutMinutes).toBe(5);

    const bare = new PlatformFactorySandbox({ accessToken: 'sk_test', projectId: 'proj_1' }).create(ctx, {});
    expect((bare as any)._idleTimeoutMinutes).toBe(5);
  });

  describe('builds', () => {
    function buildFetch(
      results: Array<{ status: 'ready' | 'pending' | 'failed'; templateId: string; error?: string }>,
    ) {
      const bodies: string[] = [];
      const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        bodies.push(String(init?.body));
        const result = results.length > 1 ? results.shift()! : results[0]!;
        return new Response(JSON.stringify(result), { status: 200 });
      });
      return { fetchMock, bodies };
    }

    function buildSandbox(fetchMock: typeof fetch) {
      return new PlatformFactorySandbox({
        accessToken: 'sk_test',
        projectId: 'proj_1',
        environmentId: 'env_1',
        env: { RUNTIME_ONLY: '1' },
        fetch: fetchMock,
      });
    }

    it('starts the current template build and polls it through the cached builder', async () => {
      const { fetchMock, bodies } = buildFetch([
        { status: 'pending', templateId: 'tpl_1' },
        { status: 'ready', templateId: 'tpl_1' },
      ]);
      const sandbox = buildSandbox(fetchMock as unknown as typeof fetch);
      const ctx = listContext();

      const started = await sandbox.builds!.start(ctx, { cpuCount: 4 });
      expect(started).toEqual({ buildId: 'tpl_1', templateId: 'tpl_1', status: 'pending' });
      expect(String(fetchMock.mock.calls[0]![0])).toContain('/projects/proj_1/sandbox/templates/builds');
      const sent = JSON.parse(bodies[0]!);
      expect(sent.environmentId).toBe('env_1');
      expect(JSON.stringify(sent.templateDefinition)).toContain('"cpuCount"');
      expect(JSON.stringify(sent)).not.toContain('RUNTIME_ONLY');

      const resolveCalls = (ctx.resolveHead as ReturnType<typeof vi.fn>).mock.calls.length;
      const polled = await sandbox.builds!.get(ctx, { cpuCount: 4 }, 'tpl_1');
      expect(polled).toEqual({ buildId: 'tpl_1', templateId: 'tpl_1', status: 'ready' });
      // The cached builder is reused: no second head resolution.
      expect((ctx.resolveHead as ReturnType<typeof vi.fn>).mock.calls.length).toBe(resolveCalls);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('recomputes the template after a restart and reports a moved template as unknown', async () => {
      const { fetchMock } = buildFetch([{ status: 'failed', templateId: 'tpl_1', error: 'pnpm install exited 1' }]);
      const fresh = buildSandbox(fetchMock as unknown as typeof fetch);
      const ctx = listContext();

      expect(await fresh.builds!.get(ctx, {}, 'tpl_1')).toEqual({
        buildId: 'tpl_1',
        templateId: 'tpl_1',
        status: 'failed',
        error: 'pnpm install exited 1',
      });
      expect(ctx.resolveHead).toHaveBeenCalled();

      const moved = await fresh.builds!.get(ctx, {}, 'tpl_0');
      expect(moved.status).toBe('unknown');
      expect(moved.error).toContain('tpl_1');
    });

    it('builds the resources-only template for a session without repositories', async () => {
      const { fetchMock, bodies } = buildFetch([{ status: 'ready', templateId: 'tpl_bare' }]);
      const sandbox = buildSandbox(fetchMock as unknown as typeof fetch);
      await expect(sandbox.builds!.start({ sessionId: 's', getRepositoryAccess: undefined }, {})).resolves.toEqual({
        buildId: 'tpl_bare',
        templateId: 'tpl_bare',
        status: 'ready',
      });
      expect(JSON.stringify(JSON.parse(bodies[0]!).templateDefinition)).toContain('"memoryMB"');
    });
  });
});

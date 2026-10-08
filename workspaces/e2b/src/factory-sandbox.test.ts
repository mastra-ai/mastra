import { describeFactorySandbox, isFactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import { Template } from 'e2b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { E2BFactorySandbox } from './factory-sandbox';
import { E2BSandbox } from './sandbox';
import { createRepoTemplate, repoTemplateRef } from './utils/repo-template';
import { isDeferredNamedTemplateSpec } from './utils/template';

const { sdk } = vi.hoisted(() => {
  const sdk = {
    exists: vi.fn(),
    buildInBackground: vi.fn(),
    getBuildStatus: vi.fn(),
    templatesGet: vi.fn(),
  };
  return { sdk };
});

vi.mock('e2b', async importOriginal => {
  const actual = await importOriginal<typeof import('e2b')>();
  class LogEntry {
    constructor(
      readonly timestamp: Date,
      readonly level: string,
      readonly message: string,
    ) {}
    toString() {
      return `[${this.level}] ${this.message}`;
    }
  }
  class ApiClient {
    api = { GET: (path: string, init?: unknown) => sdk.templatesGet(path, init) };
    constructor(readonly config: unknown) {}
  }
  class ConnectionConfig {
    constructor(readonly opts: unknown) {}
  }
  return {
    ...actual,
    LogEntry,
    ApiClient,
    ConnectionConfig,
    Template: Object.assign(actual.Template, {
      exists: (...args: unknown[]) => sdk.exists(...args),
      buildInBackground: (...args: unknown[]) => sdk.buildInBackground(...args),
      getBuildStatus: (...args: unknown[]) => sdk.getBuildStatus(...args),
    }),
  };
});

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const CLONE_URL = 'https://github.com/octocat/hello.git';
const SHA = 'a'.repeat(40);
const SETUP = 'pnpm install';

function context(): FactorySandboxContext {
  return {
    sessionId: 'sess_1',
    sandboxId: 'sbx_prev',
    getRepositoryAccess: async () => ({ cloneUrl: CLONE_URL }),
    setupCommand: SETUP,
  };
}

function logEntry(level: string, message: string) {
  return { timestamp: new Date('2026-10-08T00:00:00Z'), level, message, toString: () => `[${level}] ${message}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(async () => new Response(`${SHA}\n`, { status: 200 }));
});

describe('E2BFactorySandbox', () => {
  it('is a branded FactorySandbox with cpu and memory settings and full builds', () => {
    const sandbox = new E2BFactorySandbox({ apiKey: 'e2b_test' });
    expect(isFactorySandbox(sandbox)).toBe(true);
    const description = describeFactorySandbox(sandbox);
    expect(description.provider).toBe('e2b');
    expect(Object.keys(description.settingsSchema.properties ?? {})).toEqual([
      'cpuCount',
      'memoryMb',
      'idleTimeoutMinutes',
    ]);
    expect(description.capabilities).toEqual({ template: true, builds: { available: true, history: true } });
  });

  it('resolves the same sha-tagged ref as createRepoTemplate(ctx), with settings over defaults', async () => {
    const ctx = context();
    const callback = createRepoTemplate(ctx)!;
    const viaClass = new E2BFactorySandbox().template(ctx, {})!;
    expect(isDeferredNamedTemplateSpec(viaClass)).toBe(true);
    expect((await viaClass.resolveSpec()).ref).toBe((await callback.resolveSpec()).ref);

    const expected = repoTemplateRef({
      cloneUrl: CLONE_URL,
      setupCommand: SETUP,
      sha: SHA,
      cpuCount: 2,
      memoryMB: 4096,
    });
    const tuned = new E2BFactorySandbox({ defaults: { cpuCount: 4, memoryMb: 4096 } }).template(ctx, { cpuCount: 2 })!;
    expect((await tuned.resolveSpec()).ref).toBe(expected);
    expect((await createRepoTemplate({ ...ctx, cpuCount: 2, memoryMB: 4096 })!.resolveSpec()).ref).toBe(expected);
  });

  it('creates an E2BSandbox keyed by the session with the sandbox id and template', () => {
    const created = new E2BFactorySandbox({ apiKey: 'e2b_test', timeout: 1234 }).create(context(), {});
    expect(created).toBeInstanceOf(E2BSandbox);
    expect(created.id).toBe('sess_1');
    expect((created as any)._preferredSandboxId).toBe('sbx_prev');
    expect((created as any).connectionOpts).toEqual({ apiKey: 'e2b_test' });
    expect(created.timeout).toBe(1234);

    const tuned = new E2BFactorySandbox({ apiKey: 'e2b_test', timeout: 1234 }).create(context(), {
      idleTimeoutMinutes: 30,
    });
    expect(tuned.timeout).toBe(30 * 60_000);
    const defaulted = new E2BFactorySandbox({ defaults: { idleTimeoutMinutes: 10 } }).create(context(), {});
    expect(defaulted.timeout).toBe(10 * 60_000);
    expect(new E2BFactorySandbox({}).create(context(), {}).timeout).toBe(5 * 60_000);
  });

  describe('builds', () => {
    const sandbox = new E2BFactorySandbox({ apiKey: 'e2b_test' });
    const ref = repoTemplateRef({ cloneUrl: CLONE_URL, setupCommand: SETUP, sha: SHA });

    it('start short-circuits to ready when the sha-tagged template exists', async () => {
      sdk.exists.mockResolvedValue(true);
      const started = await sandbox.builds.start(context(), {});
      expect(started).toEqual({ buildId: `${ref}:existing`, templateId: ref, status: 'ready' });
      expect(sdk.exists).toHaveBeenCalledWith(ref, { apiKey: 'e2b_test' });
      expect(sdk.buildInBackground).not.toHaveBeenCalled();
    });

    it('start builds in the background with the sha tag and resources', async () => {
      sdk.exists.mockResolvedValue(false);
      sdk.buildInBackground.mockResolvedValue({
        templateId: 'tpl_1',
        buildId: 'bld_1',
        name: ref,
        alias: ref,
        tags: [],
      });
      const started = await sandbox.builds.start(context(), { cpuCount: 2 });
      expect(started).toEqual({ buildId: 'tpl_1:bld_1', templateId: 'tpl_1', status: 'pending' });
      const expectedRef = repoTemplateRef({ cloneUrl: CLONE_URL, setupCommand: SETUP, sha: SHA, cpuCount: 2 });
      expect(sdk.buildInBackground).toHaveBeenCalledWith(expect.any(Object), expectedRef, {
        apiKey: 'e2b_test',
        tags: ['current'],
        cpuCount: 2,
        memoryMB: 1024,
      });
      const built = sdk.buildInBackground.mock.calls[0]![0];
      const direct = (await createRepoTemplate({ ...context(), cpuCount: 2 })!.resolveSpec()).template;
      expect(await Template.toJSON(built as never, false)).toBe(await Template.toJSON(direct as never, false));
    });

    it('get answers ready for an existing id without calling the SDK', async () => {
      const build = await sandbox.builds.get(context(), {}, `${ref}:existing`);
      expect(build).toEqual({ buildId: `${ref}:existing`, templateId: ref, status: 'ready' });
      expect(sdk.getBuildStatus).not.toHaveBeenCalled();
    });

    it.each([
      ['waiting', 'pending'],
      ['building', 'building'],
      ['ready', 'ready'],
      ['error', 'failed'],
    ])('get maps SDK status %s to %s with logs', async (sdkStatus, status) => {
      sdk.getBuildStatus.mockResolvedValue({
        buildID: 'bld_1',
        templateID: 'tpl_1',
        status: sdkStatus,
        logEntries: [logEntry('info', 'cloning'), logEntry('error', 'boom')],
        logs: ['cloning', 'boom'],
        ...(sdkStatus === 'error' ? { reason: { message: 'setup failed', logEntries: [] } } : {}),
      });
      const build = await sandbox.builds.get(context(), {}, 'tpl_1:bld_1');
      expect(sdk.getBuildStatus).toHaveBeenCalledWith(
        { templateId: 'tpl_1', buildId: 'bld_1' },
        { apiKey: 'e2b_test' },
      );
      expect(build).toEqual({
        buildId: 'tpl_1:bld_1',
        templateId: 'tpl_1',
        status,
        logs: ['[info] cloning', '[error] boom'],
        ...(sdkStatus === 'error' ? { error: 'setup failed' } : {}),
      });
    });

    it('get splits a composite id on the last colon so a ref with a tag survives', async () => {
      sdk.getBuildStatus.mockResolvedValue({
        buildID: 'b',
        templateID: ref,
        status: 'ready',
        logEntries: [],
        logs: [],
      });
      const build = await sandbox.builds.get(context(), {}, `${ref}:bld_9`);
      expect(sdk.getBuildStatus).toHaveBeenCalledWith({ templateId: ref, buildId: 'bld_9' }, { apiKey: 'e2b_test' });
      expect(build.logs).toBeUndefined();
      await expect(sandbox.builds.get(context(), {}, 'no-colon')).rejects.toThrow(/Invalid E2B build id/);
    });

    it('list returns the builds of the resolved template, newest first', async () => {
      const name = ref.slice(0, ref.lastIndexOf(':'));
      sdk.templatesGet.mockImplementation(async (path: string) => {
        if (path === '/templates') {
          return {
            data: [
              { templateID: 'tpl_other', buildID: 'bld_x', buildStatus: 'ready', names: ['someone-else'], aliases: [] },
              { templateID: 'tpl_1', buildID: 'bld_new', buildStatus: 'building', names: [], aliases: [name] },
            ],
          };
        }
        return {
          data: {
            templateID: 'tpl_1',
            builds: [
              {
                buildID: 'bld_old',
                status: 'ready',
                createdAt: '2026-10-01T00:00:00Z',
                finishedAt: '2026-10-01T00:05:00Z',
              },
              { buildID: 'bld_new', status: 'building', createdAt: '2026-10-02T00:00:00Z' },
            ],
          },
        };
      });
      const builds = await sandbox.builds.list!(context(), {});
      expect(sdk.templatesGet).toHaveBeenNthCalledWith(1, '/templates', undefined);
      expect(sdk.templatesGet).toHaveBeenNthCalledWith(2, '/templates/{templateID}', {
        params: { path: { templateID: 'tpl_1' } },
      });
      expect(builds).toEqual([
        { buildId: 'tpl_1:bld_new', templateId: 'tpl_1', status: 'building', startedAt: '2026-10-02T00:00:00Z' },
        {
          buildId: 'tpl_1:bld_old',
          templateId: 'tpl_1',
          status: 'ready',
          startedAt: '2026-10-01T00:00:00Z',
          finishedAt: '2026-10-01T00:05:00Z',
        },
      ]);

      sdk.templatesGet.mockResolvedValue({ data: [] });
      expect(await sandbox.builds.list!(context(), {})).toEqual([]);

      sdk.templatesGet.mockResolvedValue({ error: { code: 401, message: 'nope' } });
      await expect(sandbox.builds.list!(context(), {})).rejects.toThrow(/E2B template listing failed/);
    });
  });
});

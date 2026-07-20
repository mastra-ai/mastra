import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

// Capture audit events at the store boundary so the real `emitAudit` path
// (actor resolution, never-throws) is exercised end to end.
let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

vi.mock('../audit/store', () => ({
  recordAuditEvent: async (input: any) => {
    if (auditFailure) throw auditFailure;
    auditRecorded.push(input);
    return {
      id: `00000000-0000-4000-9000-${String(auditRecorded.length).padStart(12, '0')}`,
      occurredAt: new Date(),
      ...input,
      githubProjectId: input.githubProjectId ?? null,
      metadata: input.metadata ?? {},
      context: input.context ?? {},
    };
  },
  listAuditEvents: async () => ({ events: [] }),
}));

import { __resetRuntimeConfigForTests } from '../runtime-config';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { mountApiRoutes } from '../test-utils';
import { buildIntakeRoutes } from './routes';
import { DEFAULT_INTAKE_CONFIG, parseIntakeConfig } from './store';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as any, buildIntakeRoutes());
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await seedFactoryStorageForTests();
  auditRecorded = [];
  auditFailure = undefined;
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.clearAllMocks();
});

describe('GET /web/intake/config', () => {
  it('401s without a user', async () => {
    const res = await buildApp(null).request('/web/intake/config');
    expect(res.status).toBe(401);
  });

  it('403s without an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request('/web/intake/config');
    expect(res.status).toBe(403);
  });

  it('returns the defaults when nothing is saved', async () => {
    const res = await buildApp(orgUser).request('/web/intake/config');
    expect(await res.json()).toEqual({ config: DEFAULT_INTAKE_CONFIG });
  });

  it('returns the saved config for the caller', async () => {
    await seed.intake.saveConfig('org1', 'u1', {
      github: { enabled: false, repositoryIds: null },
      linear: { enabled: true, projectIds: ['lp-1'] },
    });
    const res = await buildApp(orgUser).request('/web/intake/config');
    const json = await res.json();
    expect(json.config.github.enabled).toBe(false);
    expect(json.config.linear.projectIds).toEqual(['lp-1']);
  });

  it('scopes the config per user', async () => {
    await seed.intake.saveConfig('org1', 'other-user', {
      github: { enabled: false, repositoryIds: null },
      linear: { enabled: false, projectIds: null },
    });
    const res = await buildApp(orgUser).request('/web/intake/config');
    expect(await res.json()).toEqual({ config: DEFAULT_INTAKE_CONFIG });
  });
});

describe('PUT /web/intake/config', () => {
  const put = (body: unknown, user = orgUser) =>
    buildApp(user).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('saves a valid config and echoes it back', async () => {
    const config = {
      github: { enabled: true, repositoryIds: ['gp-1'] },
      linear: { enabled: false, projectIds: null },
    };
    const res = await put(config);
    expect(await res.json()).toEqual({ config });
    expect(await seed.intake.getConfig('org1', 'u1')).toEqual(config);
  });

  it('upserts over an existing config', async () => {
    await put({ github: { enabled: true, repositoryIds: null }, linear: { enabled: true, projectIds: null } });
    await put({ github: { enabled: false, repositoryIds: null }, linear: { enabled: true, projectIds: ['lp-9'] } });
    const saved = await seed.intake.getConfig('org1', 'u1');
    expect(saved.github.enabled).toBe(false);
    expect(saved.linear.projectIds).toEqual(['lp-9']);
  });

  it('400s on an invalid shape', async () => {
    const res = await put({ github: { enabled: 'yes' }, linear: { enabled: true } });
    expect(res.status).toBe(400);
    expect(await seed.intake.getConfig('org1', 'u1')).toEqual(DEFAULT_INTAKE_CONFIG);
  });

  it('400s on invalid JSON', async () => {
    const res = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('records intake.config_updated with a bounded source summary', async () => {
    await put({
      github: { enabled: true, repositoryIds: ['gp-1', 'gp-2'] },
      linear: { enabled: false, projectIds: null },
    });
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      orgId: 'org1',
      actorId: 'u1',
      action: 'factory.intake.config_updated',
      targets: [{ type: 'intake_config', id: 'org1' }],
      metadata: {
        github: { enabled: true, repositories: 2 },
        linear: { enabled: false, projects: null },
      },
    });
  });

  it('does not record an audit event when the config is rejected', async () => {
    await put({ github: { enabled: 'yes' }, linear: { enabled: true } });
    expect(auditRecorded).toHaveLength(0);
  });

  it('still saves the config when the audit insert throws', async () => {
    auditFailure = new Error('audit db down');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { github: { enabled: true, repositoryIds: null }, linear: { enabled: false, projectIds: null } };
    const res = await put(config);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config });
    expect(await seed.intake.getConfig('org1', 'u1')).toEqual(config);
    expect(warnSpy).toHaveBeenCalledWith('[Audit] Failed to emit audit event', expect.anything());
    warnSpy.mockRestore();
  });
});

describe('parseIntakeConfig', () => {
  it('accepts explicit selections', () => {
    expect(
      parseIntakeConfig({ github: { enabled: true, repositoryIds: ['a'] }, linear: { enabled: true, projectIds: [] } }),
    ).toEqual({ github: { enabled: true, repositoryIds: ['a'] }, linear: { enabled: true, projectIds: [] } });
  });

  it('treats missing id lists as null (default selection)', () => {
    expect(parseIntakeConfig({ github: { enabled: true }, linear: { enabled: false } })).toEqual({
      github: { enabled: true, repositoryIds: null },
      linear: { enabled: false, projectIds: null },
    });
  });

  it('rejects non-string ids and oversized lists', () => {
    expect(parseIntakeConfig({ github: { enabled: true, repositoryIds: [1] }, linear: { enabled: true } })).toBeNull();
    expect(
      parseIntakeConfig({
        github: { enabled: true },
        linear: { enabled: true, projectIds: Array.from({ length: 201 }, (_, i) => `t${i}`) },
      }),
    ).toBeNull();
  });

  it('rejects missing sections', () => {
    expect(parseIntakeConfig({ github: { enabled: true } })).toBeNull();
    expect(parseIntakeConfig(null)).toBeNull();
  });

  it('rejects the prerelease github.projectIds key without translating it', () => {
    expect(
      parseIntakeConfig({
        github: { enabled: true, projectIds: ['old-1'] },
        linear: { enabled: true, projectIds: null },
      }),
    ).toBeNull();
  });
});

describe('GET /web/intake/config with prerelease storage rows', () => {
  it('returns defaults when a stored row still uses github.projectIds', async () => {
    // Seed through the backend ops path so the typed save path cannot rewrite it.
    const now = new Date();
    await seed.storage.ops.insertOne('intake_settings', {
      org_id: 'org1',
      user_id: 'u1',
      config: {
        github: { enabled: false, projectIds: ['old-gp'] },
        linear: { enabled: true, projectIds: ['lp-legacy'] },
      },
      created_at: now,
      updated_at: now,
    });
    const res = await buildApp(orgUser).request('/web/intake/config');
    const json = await res.json();
    expect(json).toEqual({ config: DEFAULT_INTAKE_CONFIG });
    expect(JSON.stringify(json)).not.toContain('projectIds":["old-gp"]');
    expect(json.config.github).not.toHaveProperty('projectIds');
    expect(json.config.github).toHaveProperty('repositoryIds');
  });
});

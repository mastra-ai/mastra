import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('drizzle-orm', async () => {
  const actual = (await vi.importActual('drizzle-orm')) as Record<string, unknown>;
  return {
    ...actual,
    eq: (column: any, value: any) => ({ kind: 'eq', column: column?.name, value }),
    and: (...conds: any[]) => ({ kind: 'and', conds: conds.filter(Boolean) }),
  };
});

// In-memory intake_settings table.
let settings: Array<Record<string, any>> = [];

function matches(table: any, row: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') return cond.conds.every((c: any) => matches(table, row, c));
  if (cond.kind === 'eq') {
    for (const [jsKey, col] of Object.entries(table)) {
      if ((col as any)?.name === cond.column) return row[jsKey] === cond.value;
    }
    return false;
  }
  return true;
}

vi.mock('../github/db', () => ({
  getAppDb: () => ({
    select: () => ({
      from: (table: any) => ({
        where: async (cond: any) => settings.filter(row => matches(table, row, cond)),
      }),
    }),
    insert: () => ({
      values: (vals: any) => ({
        onConflictDoUpdate: (opts: any) => {
          const existing = settings.find(row => row.orgId === vals.orgId && row.userId === vals.userId);
          if (existing) Object.assign(existing, opts?.set ?? {});
          else settings.push({ id: `id-${settings.length + 1}`, ...vals });
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

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

beforeEach(() => {
  settings = [];
});

afterEach(() => {
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
    settings.push({
      orgId: 'org1',
      userId: 'u1',
      config: { github: { enabled: false, projectIds: null }, linear: { enabled: true, projectIds: ['lp-1'] } },
    });
    const res = await buildApp(orgUser).request('/web/intake/config');
    const json = await res.json();
    expect(json.config.github.enabled).toBe(false);
    expect(json.config.linear.projectIds).toEqual(['lp-1']);
  });

  it('scopes the config per user', async () => {
    settings.push({
      orgId: 'org1',
      userId: 'other-user',
      config: { github: { enabled: false, projectIds: null }, linear: { enabled: false, projectIds: null } },
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
      github: { enabled: true, projectIds: ['gp-1'] },
      linear: { enabled: false, projectIds: null },
    };
    const res = await put(config);
    expect(await res.json()).toEqual({ config });
    expect(settings[0]).toMatchObject({ orgId: 'org1', userId: 'u1', config });
  });

  it('upserts over an existing config', async () => {
    await put({ github: { enabled: true, projectIds: null }, linear: { enabled: true, projectIds: null } });
    await put({ github: { enabled: false, projectIds: null }, linear: { enabled: true, projectIds: ['lp-9'] } });
    expect(settings).toHaveLength(1);
    expect(settings[0].config.github.enabled).toBe(false);
    expect(settings[0].config.linear.projectIds).toEqual(['lp-9']);
  });

  it('400s on an invalid shape', async () => {
    const res = await put({ github: { enabled: 'yes' }, linear: { enabled: true } });
    expect(res.status).toBe(400);
    expect(settings).toHaveLength(0);
  });

  it('400s on invalid JSON', async () => {
    const res = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});

describe('parseIntakeConfig', () => {
  it('accepts explicit selections', () => {
    expect(
      parseIntakeConfig({ github: { enabled: true, projectIds: ['a'] }, linear: { enabled: true, projectIds: [] } }),
    ).toEqual({ github: { enabled: true, projectIds: ['a'] }, linear: { enabled: true, projectIds: [] } });
  });

  it('treats missing id lists as null (default selection)', () => {
    expect(parseIntakeConfig({ github: { enabled: true }, linear: { enabled: false } })).toEqual({
      github: { enabled: true, projectIds: null },
      linear: { enabled: false, projectIds: null },
    });
  });

  it('rejects non-string ids and oversized lists', () => {
    expect(parseIntakeConfig({ github: { enabled: true, projectIds: [1] }, linear: { enabled: true } })).toBeNull();
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
});

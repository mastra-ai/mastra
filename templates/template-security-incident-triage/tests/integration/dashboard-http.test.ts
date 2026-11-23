import { Hono } from 'hono';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sealSessionIssuedAt } from '../../src/app/auth/session-lifetime.js';
import { openPkceState } from '../../src/app/auth/pkce-state.js';
import type { DashboardSessionClient } from '../../src/app/auth/workos-session.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { defensiveHeadersMiddleware, requestContextMiddleware, type AppEnv } from '../../src/http-context.js';
import { consoleLogger } from '../../src/logging.js';
import { registerDashboardRoutes } from '../../src/app/dashboard/routes.js';
import { dashboardJs } from '../../src/app/dashboard/assets.js';
import {
  dashboardLastTimelineSequence,
  readDashboardIncident,
  readDashboardTimelineSnapshot,
} from '../../src/app/dashboard/queries.js';
import { validateSseReplay } from '../../src/app/dashboard/sse.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { persistAuthoritativeTriageResult } from '../../src/db/triage-result-operations.js';
import { createIncidentFromAlert, transitionIncident } from '../../src/db/incident-operations.js';
import { requestApproval } from '../../src/db/approval-operations.js';
import { recordContainmentOutcome } from '../../src/db/containment-outcome-operations.js';
import { ContainmentGateway } from '../../src/containment/gateway.js';
import { retryPartialContainment } from '../../src/containment/partial-retry.js';
import type { LocalContainmentState } from '../../src/containment/local-state.js';
import {
  createApprovalRunReconciler,
  type ReconcileApprovalRun,
} from '../../src/approval/workflow-resume-reconciler.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { createCsrfToken } from '../../src/app/auth/csrf.js';
import { makeAlert, makeApprovalRequest, makePlan, seedAuthoritativeTriageResult } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const secret = 's'.repeat(32);
const now = Date.parse('2026-08-28T18:02:00.000Z');
const config = {
  enabled: true,
  dashboardOrigin: 'https://dashboard.test',
  csrfSecret: secret,
  sessionMaxAgeSeconds: 28_800,
  sseMaxConnections: 1,
};

const sessionClient: DashboardSessionClient = {
  startLogin: async () => ({
    authorizationUrl: 'https://api.workos.com/user_management/authorize',
    state: 's'.repeat(16),
    codeVerifier: 'v'.repeat(43),
  }),
  completeLogin: async () => ({
    sealedSession: 'sealed',
    session: {
      userId: 'user_123',
      sessionId: 'session_123',
      organizationId: 'tenant_123',
      roles: ['viewer'],
    },
  }),
  authenticate: async () => ({
    userId: 'user_123',
    sessionId: 'session_123',
    organizationId: 'tenant_123',
    roles: ['viewer'],
  }),
  refresh: async () => ({ kind: 'terminal' }),
  getLogoutUrl: async () => null,
  listOrganizations: async () => [],
};

const store: OperationalStore = {
  execute: async () => ({ rows: [] }) as never,
  transaction: async operation =>
    operation({
      execute: store.execute,
      batch: async () => [] as never,
    }),
  close: () => undefined,
};

function app(
  client: DashboardSessionClient = sessionClient,
  operationalStore = store,
  responseSecret?: string,
  reconcileApprovalRun: ReconcileApprovalRun = async () => 'completed',
  dashboardOrigin = config.dashboardOrigin,
) {
  const app = new Hono<AppEnv>();
  app.use(
    '*',
    requestContextMiddleware(() => 'request-1'),
  );
  app.use('*', defensiveHeadersMiddleware);
  registerDashboardRoutes(app, {
    store: operationalStore,
    logger: consoleLogger,
    config: { ...config, dashboardOrigin },
    approvalConfig: {
      mode: 'local',
      localApprovalsEnabled: false,
      actionTimeoutMs: 1_000,
      rateLimit: 1,
      ...(responseSecret ? { approvalResumeSecret: responseSecret } : {}),
    },
    sessionClient: client,
    reconcileApprovalRun,
    nowMs: () => now,
  });
  return app;
}

const databases: TempDatabase[] = [];
afterEach(async () => Promise.all(databases.splice(0).map(database => database.cleanup())));

async function approvalStore(
  plan = makePlan({
    createdAt: '2026-08-28T18:00:00.000Z',
    expiresAt: '2026-08-28T18:15:00.000Z',
  }),
) {
  const database = await createTempDatabase();
  databases.push(database);
  const operationalStore = database.createStore();
  await migrateOperationalStore(operationalStore);
  await createIncidentFromAlert(operationalStore, makeAlert(), {
    clock: fixedClock('2026-08-27T12:00:00.000Z'),
    ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
  });
  await transitionIncident(
    operationalStore,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      expectedVersion: 0,
      to: 'investigating',
      runId: 'run-1',
      correlationId: 'c',
    },
    {
      clock: fixedClock('2026-08-27T12:00:30.000Z'),
      ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
    },
  );
  await operationalStore.execute({
    sql: "INSERT INTO workflow_runs(id,incident_id,tenant_id,run_id,workflow_id,status,started_at) VALUES ('workflow-row-1','incident-1','tenant-1','run-1','security-incident-workflow','running','2026-08-27T12:00:30.000Z')",
  });
  await operationalStore.execute({
    sql: "UPDATE incidents SET current_run_id='run-1' WHERE id='incident-1'",
  });
  const approval = makeApprovalRequest({
    requestedAt: '2026-08-28T18:01:00.000Z',
    expiresAt: plan.expiresAt,
    planId: plan.planId,
    incidentId: plan.incidentId,
    planHash: plan.planHash,
  });
  await seedAuthoritativeTriageResult(operationalStore, plan);
  await requestApproval(
    operationalStore,
    {
      plan,
      approval,
      expectedIncidentVersion: 1,
      runId: 'run-1',
      correlationId: 'c',
    },
    {
      clock: fixedClock('2026-08-28T18:01:00.000Z'),
      ids: sequenceIdGenerator([
        ...plan.actions.map((_, index) => `action-row-${index + 1}`),
        'timeline-3',
        'outbox-3',
      ]),
    },
  );
  return operationalStore;
}

async function benignStore() {
  const database = await createTempDatabase();
  databases.push(database);
  const operationalStore = database.createStore();
  await migrateOperationalStore(operationalStore);
  await createIncidentFromAlert(operationalStore, makeAlert(), {
    clock: fixedClock('2026-08-27T12:00:00.000Z'),
    ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
  });
  await transitionIncident(
    operationalStore,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      expectedVersion: 0,
      to: 'investigating',
      runId: 'run-1',
      correlationId: 'benign-f5',
    },
    {
      clock: fixedClock('2026-08-27T12:00:30.000Z'),
      ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
    },
  );
  await operationalStore.execute({
    sql: "INSERT INTO workflow_runs(id,incident_id,tenant_id,run_id,workflow_id,status,started_at) VALUES ('workflow-row-1','incident-1','tenant-1','run-1','security-incident-workflow','completed','2026-08-27T12:00:30.000Z')",
  });
  await operationalStore.execute({
    sql: "UPDATE incidents SET current_run_id='run-1' WHERE id='incident-1'",
  });
  await persistAuthoritativeTriageResult(operationalStore, {
    tenantId: 'tenant-1',
    incidentId: 'incident-1',
    workflowRunId: 'run-1',
    result: {
      status: 'manual-review',
      incidentId: 'incident-1',
      reasonCodes: ['CONFIDENCE_BELOW_THRESHOLD'],
    },
  });
  return operationalStore;
}

function containmentState(): LocalContainmentState {
  return {
    sessions: new Map([['session-1', 'active']]),
    roles: new Map([['subject-1', 'admin']]),
    devices: new Map(),
    reauthentication: new Map(),
    calls: new Map(),
  };
}

function trackedApprovalReconciler() {
  let receiptId: string | undefined;
  let finalStatus: 'contained' | undefined;
  const reconcile = createApprovalRunReconciler({
    read: async () => {
      if (!receiptId) return { status: 'suspended' };
      const receipt = {
        resumePayload: { resumeReceiptId: receiptId },
      };
      return finalStatus
        ? {
            status: 'completed',
            result: { status: finalStatus },
            steps: { 'await-approval': receipt },
          }
        : { status: 'running', steps: { 'await-approval': receipt } };
    },
    resume: async ({ resumeReceiptId }) => {
      receiptId = resumeReceiptId;
    },
  });
  return {
    reconcile,
    complete: () => {
      finalStatus = 'contained';
    },
    receiptId: () => receiptId,
  };
}

function cookie() {
  return `__Host-authkit-session=sealed; __Host-authkit-issued-at=${sealSessionIssuedAt(secret, now)}`;
}

async function submitDashboardDecisionWithBundle(
  application: ReturnType<typeof app>,
  plan: ReturnType<typeof makePlan>,
) {
  const listeners = new Map<string, (event: { preventDefault(): void }) => Promise<void>>();
  const error = { textContent: '' };
  const buttons = [{ disabled: false }];
  const form = {
    dataset: { incidentId: 'incident-1' },
    addEventListener(type: string, listener: (event: { preventDefault(): void }) => Promise<void>) {
      listeners.set(type, listener);
    },
    setAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => buttons,
  };
  const dialog = { addEventListener() {}, close() {}, showModal() {} };
  const root = {
    dataset: { incidentId: 'incident-1', timelineCursor: 'incident-1:3' },
  };
  class BrowserFormData {
    get(key: string) {
      return (
        {
          csrfToken: createCsrfToken(secret, {
            sessionId: 'session-1',
            tenantId: 'tenant-1',
          }),
          decision: 'approved',
          reason: '',
          planId: plan.planId,
          planHashVersion: '1',
          planHash: plan.planHash,
        }[key] ?? null
      );
    }
  }
  let reloaded = false;
  class BrowserEventSource {
    onopen?: () => void;
    onmessage?: (event: { data: string; lastEventId: string }) => void;
    addEventListener() {}
    close() {}
  }
  vm.runInNewContext(dashboardJs, {
    document: {
      activeElement: null,
      querySelector(selector: string) {
        if (selector === '[data-incident-id]') return root;
        if (selector === '[data-decision-form]') return form;
        if (selector === '[data-decision-error]') return error;
        return null;
      },
      querySelectorAll: (selector: string) => (selector === '[data-timeline-event]' ? [] : []),
      getElementById: () => dialog,
    },
    window: {
      EventSource: BrowserEventSource,
      location: {
        reload: () => {
          reloaded = true;
        },
      },
    },
    EventSource: BrowserEventSource,
    FormData: BrowserFormData,
    fetch: (path: string, init?: RequestInit) =>
      application.request(`https://dashboard.test${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Cookie: cookie(),
          Origin: 'https://dashboard.test',
          'Sec-Fetch-Site': 'same-origin',
        },
      }),
  });
  await listeners.get('submit')?.({ preventDefault() {} });
  return { error, reloaded };
}

describe('dashboard HTTP boundaries', () => {
  it.each([
    ['http://localhost:3000', 'authkit-local-', false],
    ['http://127.0.0.1:3000', 'authkit-local-', false],
    ['http://[::1]:3000', 'authkit-local-', false],
    ['https://localhost:3000', '__Host-authkit-', true],
    ['https://dashboard.test', '__Host-authkit-', true],
  ])('preserves login, refresh, and logout cookies on %s', async (origin, prefix, secure) => {
    const authenticate = vi.fn(async () => sessionClient.authenticate('sealed'));
    const application = app(
      {
        ...sessionClient,
        authenticate,
        refresh: async () => ({
          kind: 'ok',
          sealedSession: 'rotated',
          session: (await sessionClient.authenticate('sealed'))!,
        }),
      },
      store,
      undefined,
      undefined,
      origin,
    );
    const login = await application.request(`${origin}/auth/login`);
    expect(login.status).toBe(302);
    const pkce = login.headers.getSetCookie()[0]!;
    expect(pkce).toMatch(new RegExp(`^${prefix}pkce=`));
    expect(pkce).toContain('HttpOnly');
    expect(pkce).toContain('SameSite=Lax');
    expect(pkce).toContain('Path=/');
    expect(pkce.includes('; Secure')).toBe(secure);
    expect(pkce).not.toContain('Domain=');
    const state = openPkceState(secret, pkce.split(';')[0]!.split('=')[1], now)!;
    const callback = await application.request(`${origin}/auth/callback?code=code_123&state=${state.state}`, {
      headers: { Cookie: pkce.split(';')[0]! },
    });
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/dashboard');
    const cookies = callback.headers.getSetCookie();
    expect(cookies).toHaveLength(3);
    expect(cookies.find(value => value.startsWith(`${prefix}pkce=`))).toContain('Max-Age=0');
    expect(cookies.some(value => value.startsWith(`${prefix}session=sealed;`))).toBe(true);
    expect(cookies.some(value => value.startsWith(`${prefix}issued-at=`))).toBe(true);
    for (const value of cookies) {
      expect(value.includes('; Secure')).toBe(secure);
      expect(value).toContain('HttpOnly');
      expect(value).toContain('SameSite=Lax');
    }
    const sessionCookies = cookies
      .filter(value => !value.startsWith(`${prefix}pkce=`))
      .map(value => value.split(';')[0])
      .join('; ');
    authenticate.mockResolvedValueOnce(null);
    const dashboard = await application.request(`${origin}/dashboard`, {
      headers: { Cookie: sessionCookies },
    });
    expect(dashboard.status).toBe(200);
    expect(authenticate).toHaveBeenCalledWith('sealed');
    expect(dashboard.headers.get('set-cookie')).toContain(`${prefix}session=rotated;`);
    expect(dashboard.headers.get('set-cookie')!.includes('; Secure')).toBe(secure);
    const logout = await application.request(`${origin}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookies, Origin: origin },
    });
    expect(logout.status).toBe(303);
    const cleared = logout.headers.getSetCookie();
    expect(cleared).toHaveLength(2);
    for (const value of cleared) {
      expect(value).toMatch(new RegExp(`^${prefix}(session|issued-at)=;`));
      expect(value).toContain('Max-Age=0');
      expect(value.includes('; Secure')).toBe(secure);
    }
  });

  it.each(['http://dashboard.test', 'http://localhost.evil.test', 'https://dashboard.test'])(
    'does not let request or proxy headers downgrade cookies for %s',
    async origin => {
      const application = app(sessionClient, store, undefined, undefined, origin);
      const response = await application.request('http://localhost:3000/auth/login', {
        headers: {
          Host: 'localhost:3000',
          'X-Forwarded-Proto': 'http',
          'X-Forwarded-Host': 'localhost:3000',
        },
      });
      const cookie = response.headers.get('set-cookie')!;
      expect(cookie).toContain('__Host-authkit-pkce=');
      expect(cookie).toContain('; Secure');
    },
  );

  it('still rejects absent, tampered, or mismatched local callback state', async () => {
    const completeLogin = vi.fn(sessionClient.completeLogin);
    const application = app({ ...sessionClient, completeLogin }, store, undefined, undefined, 'http://localhost:3000');
    const login = await application.request('http://localhost:3000/auth/login');
    const pkce = login.headers.getSetCookie()[0]!.split(';')[0]!;
    for (const [cookie, state] of [
      ['', 's'.repeat(16)],
      [`${pkce}x`, 's'.repeat(16)],
      [pkce, 'mismatch'],
    ]) {
      const response = await application.request(`http://localhost:3000/auth/callback?code=code_123&state=${state}`, {
        headers: { Cookie: cookie! },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'AUTH_CALLBACK_INVALID',
      });
    }
    expect(completeLogin).not.toHaveBeenCalled();
  });

  it('keeps PKCE state recoverable when AuthKit callback is transiently unavailable', async () => {
    const application = app({
      ...sessionClient,
      completeLogin: async () => {
        throw new Error('timeout');
      },
    });
    const login = await application.request('https://dashboard.test/auth/login');
    const stateCookie = login.headers.get('set-cookie')!;
    const state = openPkceState(secret, /__Host-authkit-pkce=([^;]+)/u.exec(stateCookie)?.[1], now)!;
    const response = await application.request(
      `https://dashboard.test/auth/callback?code=code_1&state=${state.state}`,
      { headers: { Cookie: stateCookie } },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ retryable: true });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('cleans PKCE state and maps an invalid_grant callback to a terminal 400', async () => {
    const application = app({
      ...sessionClient,
      completeLogin: async () => {
        throw { code: 'invalid_grant' };
      },
    });
    const login = await application.request('https://dashboard.test/auth/login');
    const stateCookie = login.headers.get('set-cookie')!;
    const state = openPkceState(secret, /__Host-authkit-pkce=([^;]+)/u.exec(stateCookie)?.[1], now)!;
    const response = await application.request(
      `https://dashboard.test/auth/callback?code=code_1&state=${state.state}`,
      { headers: { Cookie: stateCookie } },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('maps a transient organization switch refresh to retryable 503', async () => {
    const response = await app({
      ...sessionClient,
      authenticate: async () => ({
        userId: 'user_123',
        sessionId: 'session_123',
        organizationId: 'tenant_123',
        roles: ['viewer'],
      }),
      refresh: async () => {
        throw new Error('timeout');
      },
    }).request('https://dashboard.test/auth/organization', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        organizationId: 'tenant_456',
        csrfToken: createCsrfToken(secret, {
          sessionId: 'session_123',
          tenantId: 'tenant_123',
        }),
      }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('3');
    await expect(response.json()).resolves.toMatchObject({ retryable: true });
  });
  it('cleans the session when an organization switch refresh is terminal', async () => {
    const response = await app({
      ...sessionClient,
      authenticate: async () => ({
        userId: 'user_123',
        sessionId: 'session_123',
        organizationId: 'tenant_123',
        roles: ['viewer'],
      }),
      refresh: async () => ({ kind: 'terminal' }),
    }).request('https://dashboard.test/auth/organization', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        organizationId: 'tenant_456',
        csrfToken: createCsrfToken(secret, {
          sessionId: 'session_123',
          tenantId: 'tenant_123',
        }),
      }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('uses the rotated sealed session for logout after authentication refresh', async () => {
    const seen: string[] = [];
    const client: DashboardSessionClient = {
      ...sessionClient,
      authenticate: async () => null,
      refresh: async sealed => {
        seen.push(sealed);
        return {
          kind: 'ok',
          sealedSession: 'rotated',
          session: {
            userId: 'user_1',
            sessionId: 'session_rotated',
            organizationId: 'tenant_123',
            roles: ['viewer'],
          },
        };
      },
      getLogoutUrl: async sessionId => {
        seen.push(sessionId);
        return null;
      },
    };
    const response = await app(client).request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        csrfToken: createCsrfToken(secret, {
          sessionId: 'session_rotated',
          tenantId: 'tenant_123',
        }),
      }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(seen).toEqual(['sealed', 'session_rotated']);
  });
  it('clears a stale local session during a same-origin logout', async () => {
    const response = await app({
      ...sessionClient,
      authenticate: async () => null,
      refresh: async () => ({ kind: 'terminal' }),
    }).request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: 'stale' }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('allows same-origin logout to recover from a stale CSRF token', async () => {
    const response = await app().request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: 'stale' }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('accepts a valid CSRF token when browser origin metadata is absent', async () => {
    const response = await app().request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        csrfToken: createCsrfToken(secret, {
          sessionId: 'sealed',
          tenantId: 'dashboard-logout',
        }),
      }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('accepts the logout token rendered by the dashboard page', async () => {
    const application = app();
    const page = await application.request('https://dashboard.test/dashboard', {
      headers: { Cookie: cookie() },
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    const logoutForm = /<form method="post" action="\/auth\/logout">([\s\S]*?)<\/form>/u.exec(html)?.[1];
    const token = /name="csrfToken" value="([^"]+)"/u.exec(logoutForm ?? '')?.[1];
    expect(token).toBeTruthy();

    const response = await application.request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: token! }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
  });
  it('validates logout locally when the WorkOS session is already terminal', async () => {
    const response = await app({
      ...sessionClient,
      authenticate: async () => null,
      refresh: async () => ({ kind: 'terminal' }),
    }).request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        csrfToken: createCsrfToken(secret, {
          sessionId: 'sealed',
          tenantId: 'dashboard-logout',
        }),
      }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('trusts an exact Origin when fetch metadata reports a user navigation', async () => {
    const response = await app().request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'none',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: 'stale' }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('does not let a cross-site request clear a dashboard session', async () => {
    const response = await app().request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://untrusted.test',
        'Sec-Fetch-Site': 'cross-site',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: 'stale' }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('accepts a valid token with browser-confirmed same-origin metadata', async () => {
    const response = await app().request('https://dashboard.test/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://proxy-origin.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        csrfToken: createCsrfToken(secret, {
          sessionId: 'sealed',
          tenantId: 'dashboard-logout',
        }),
      }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/dashboard');
  });
  it('rejects direct GET navigation to the mutating logout endpoint', async () => {
    const response = await app().request('https://dashboard.test/auth/logout');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    await expect(response.json()).resolves.toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
    });
  });
  it('rejects oversized public auth form mutations before authentication or CSRF', async () => {
    const calls: string[] = [];
    const application = app({
      ...sessionClient,
      authenticate: async () => {
        calls.push('authenticate');
        return sessionClient.authenticate('sealed');
      },
      refresh: async () => {
        calls.push('refresh');
        return { kind: 'terminal' };
      },
      getLogoutUrl: async () => {
        calls.push('logout-url');
        return null;
      },
    });
    const oversizedForm = new URLSearchParams({
      csrfToken: 'x'.repeat(1_100_002),
    });
    for (const path of ['/auth/logout', '/auth/organization']) {
      const response = await application.request(`https://dashboard.test${path}`, {
        method: 'POST',
        headers: {
          Cookie: cookie(),
          Origin: 'https://dashboard.test',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: oversizedForm,
      });
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        retryable: false,
      });
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    expect(calls).toEqual([]);
  });
  it('E2E mock SOC benign: UI/API projects an investigating incident without containment', async () => {
    const operationalStore = await benignStore();
    const client = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'studio-soc-manager',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['soc_manager'] as string[],
      }),
    };
    const application = app(client, operationalStore);
    const response = await application.request('https://dashboard.test/api/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    if (response.status !== 200) throw new Error(await response.text());
    await expect(response.json()).resolves.toMatchObject({
      incident: { status: 'investigating' },
      plan: null,
      actions: [],
      manualReview: {
        status: 'manual-review',
        reasonCodes: ['CONFIDENCE_BELOW_THRESHOLD'],
        decision: null,
      },
    });
    const list = await application.request('https://dashboard.test/api/incidents', {
      headers: { Cookie: cookie() },
    });
    await expect(list.json()).resolves.toMatchObject({
      items: [{ incidentId: 'incident-1', status: 'investigating' }],
    });
    const listPage = await application.request('https://dashboard', {
      headers: { Cookie: cookie() },
    });
    const listHtml = await listPage.text();
    expect(listHtml).toContain('incident-1');
    const statistic = (key: string) =>
      new RegExp(`data-stat="${key}"[\\s\\S]*?<strong>(\\d+)</strong>`, 'u').exec(listHtml)?.[1];
    expect(statistic('total')).toBe('1');
    expect(statistic('open')).toBe('1');
    expect(statistic('awaiting-approval')).toBe('0');
    expect(statistic('high-priority')).toBe('0');
    const page = await application.request('https://dashboard.test/dashboard/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('All incidents');
    expect(html).toContain('<h2 id="review-heading">Human assessment required</h2>');
    expect(html).toContain('Review incident');
    expect(html).toContain('id="manual-review-dialog"');
    const stream = await application.request(
      'https://dashboard.test/api/incidents/incident-1/events?after=incident-1:1',
      { headers: { Cookie: cookie() } },
    );
    expect(stream.status).toBe(200);
    const first = await stream.body?.getReader().read();
    expect(new TextDecoder().decode(first?.value)).toContain('incident.status_changed');
  });

  it.each([
    ['accepted', 'investigating'],
    ['dismissed', 'closed'],
  ] as const)(
    'records a %s manual-review outcome without creating containment authority',
    async (decision, expectedStatus) => {
      const operationalStore = await benignStore();
      const client: DashboardSessionClient = {
        ...sessionClient,
        authenticate: async () => ({
          userId: 'studio-soc-manager',
          sessionId: 'session-1',
          organizationId: 'tenant-1',
          roles: ['soc_manager'],
        }),
        refresh: async () => ({
          kind: 'ok',
          sealedSession: 'refreshed',
          session: {
            userId: 'studio-soc-manager',
            sessionId: 'session-1',
            organizationId: 'tenant-1',
            roles: ['soc_manager'],
          },
        }),
      };
      const application = app(client, operationalStore);
      const response = await application.request('https://dashboard.test/api/incidents/incident-1/manual-review', {
        method: 'POST',
        headers: {
          Cookie: cookie(),
          Origin: 'https://dashboard.test',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          'X-CSRF-Token': createCsrfToken(secret, {
            sessionId: 'session-1',
            tenantId: 'tenant-1',
          }),
        },
        body: JSON.stringify({
          decision,
          workflowRunId: 'run-1',
          reason: decision === 'dismissed' ? 'Confirmed false positive' : undefined,
        }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        decision,
        incidentStatus: expectedStatus,
      });
      await expect(
        readDashboardIncident(operationalStore, {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
        }),
      ).resolves.toMatchObject({
        incident: { status: expectedStatus },
        plan: null,
        actions: [],
        manualReview: {
          decision: {
            decision,
            ...(decision === 'dismissed' ? { reason: 'Confirmed false positive' } : {}),
          },
        },
      });
      const containmentRows = await operationalStore.execute({
        sql: "SELECT COUNT(*) AS count FROM containment_actions WHERE incident_id = 'incident-1'",
      });
      expect(Number(containmentRows.rows[0]?.count)).toBe(0);
    },
  );

  it('closes an accepted manual review only after an explicit resolved decision', async () => {
    const operationalStore = await benignStore();
    const client: DashboardSessionClient = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'studio-soc-manager',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['soc_manager'],
      }),
      refresh: async () => ({
        kind: 'ok',
        sealedSession: 'refreshed',
        session: {
          userId: 'studio-soc-manager',
          sessionId: 'session-1',
          organizationId: 'tenant-1',
          roles: ['soc_manager'],
        },
      }),
    };
    const application = app(client, operationalStore);
    const headers = {
      Cookie: cookie(),
      Origin: 'https://dashboard.test',
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      'X-CSRF-Token': createCsrfToken(secret, {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
      }),
    };
    const decide = (decision: 'accepted' | 'resolved', reason?: string) =>
      application.request('https://dashboard.test/api/incidents/incident-1/manual-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decision,
          workflowRunId: 'run-1',
          ...(reason ? { reason } : {}),
        }),
      });

    expect((await decide('resolved', 'Investigated before acceptance')).status).toBe(409);
    expect((await decide('accepted')).status).toBe(200);

    const acceptedPage = await application.request('https://dashboard.test/dashboard/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    const acceptedHtml = await acceptedPage.text();
    expect(acceptedHtml).toContain('Finish manual review');
    expect(acceptedHtml).toContain('Mark as resolved and close');

    const resolved = await decide('resolved', 'Identity activity reviewed; no containment was required.');
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({
      decision: 'resolved',
      incidentStatus: 'closed',
    });
    await expect(
      readDashboardIncident(operationalStore, {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
      }),
    ).resolves.toMatchObject({
      incident: { status: 'closed' },
      manualReview: {
        decision: {
          decision: 'resolved',
          reason: 'Identity activity reviewed; no containment was required.',
        },
      },
    });
    const audit = await operationalStore.execute({
      sql: `SELECT COUNT(*) AS count FROM timeline_events
        WHERE incident_id = 'incident-1'
          AND type = 'triage.manual_review.decided'`,
    });
    expect(Number(audit.rows[0]?.count)).toBe(2);
    const containmentRows = await operationalStore.execute({
      sql: "SELECT COUNT(*) AS count FROM containment_actions WHERE incident_id = 'incident-1'",
    });
    expect(Number(containmentRows.rows[0]?.count)).toBe(0);
  });

  it('bootstraps a timeline longer than 200 entries from the SSR cursor without custom headers', async () => {
    const operationalStore = await approvalStore();
    for (let sequence = 4; sequence <= 204; sequence += 1) {
      await operationalStore.execute({
        sql: 'INSERT INTO timeline_events(id,incident_id,tenant_id,sequence,type,category,actor_id,correlation_id,causation_id,payload_json,schema_version,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [
          `timeline-bootstrap-${sequence}`,
          'incident-1',
          'tenant-1',
          sequence,
          'incident.status_changed',
          'incident',
          null,
          'dashboard-bootstrap',
          null,
          '{"status":"investigating"}',
          1,
          '2026-08-28T18:01:00.000Z',
        ],
      });
    }
    const client = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'viewer-1',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['viewer'] as string[],
      }),
    };
    const application = app(client, operationalStore);
    const html = await application.request('https://dashboard.test/dashboard/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    expect(await html.text()).toContain('data-timeline-event="200"');
    const stream = await application.request(
      'https://dashboard.test/api/incidents/incident-1/events?after=incident-1:200',
      { headers: { Cookie: cookie() } },
    );
    expect(stream.status).toBe(200);
    const first = await stream.body?.getReader().read();
    expect(new TextDecoder().decode(first?.value)).toContain('id: incident-1:201');
  });

  it('derives the SSR cursor from the same timeline snapshot so a concurrent append is replayed', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const operationalStore = database.createStore();
    await migrateOperationalStore(operationalStore);
    await createIncidentFromAlert(operationalStore, makeAlert(), {
      clock: fixedClock('2026-08-27T12:00:00.000Z'),
      ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
    });
    let injected = false;
    const raceStore: OperationalStore = {
      ...operationalStore,
      execute: async statement => {
        const result = await operationalStore.execute(statement);
        if (!injected && statement.sql.includes('dashboard_timeline_snapshot')) {
          injected = true;
          await operationalStore.execute({
            sql: 'INSERT INTO timeline_events(id,incident_id,tenant_id,sequence,type,category,actor_id,correlation_id,causation_id,payload_json,schema_version,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            args: [
              'timeline-2',
              'incident-1',
              'tenant-1',
              2,
              'incident.status_changed',
              'incident',
              null,
              'dashboard-snapshot-race',
              null,
              '{"status":"investigating"}',
              1,
              '2026-08-27T12:00:01.000Z',
            ],
          });
        }
        return result;
      },
    };
    const snapshot = await readDashboardTimelineSnapshot(
      raceStore,
      { tenantId: 'tenant-1', incidentId: 'incident-1' },
      200,
    );
    expect(snapshot.timeline.map(event => event.sequence)).toEqual([1]);
    expect(snapshot.cursor).toBe(1);
    await expect(
      dashboardLastTimelineSequence(operationalStore, {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
      }),
    ).resolves.toBe(2);
    await expect(
      validateSseReplay(operationalStore, { tenantId: 'tenant-1' } as never, 'incident-1', 'incident-1:1'),
    ).resolves.toMatchObject({
      after: 1,
      events: [expect.objectContaining({ sequence: 2 })],
    });
  });

  it('reads the incident aggregate through one transaction boundary instead of mixing direct reads', async () => {
    const operationalStore = await approvalStore();
    let transactions = 0;
    let directReads = 0;
    const boundaryStore: OperationalStore = {
      ...operationalStore,
      execute: async statement => {
        directReads += 1;
        return operationalStore.execute(statement);
      },
      transaction: async fn => {
        transactions += 1;
        return operationalStore.transaction(fn);
      },
    };
    await expect(
      readDashboardIncident(boundaryStore, {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
      }),
    ).resolves.toMatchObject({
      incident: { status: 'awaiting_approval' },
      approval: { approvalId: 'approval-1' },
    });
    expect(transactions).toBe(1);
    expect(directReads).toBe(0);
  });

  it('makes 401-event overflow observable to EventSource as resync instead of an opaque 409 loop', async () => {
    const operationalStore = await approvalStore();
    for (let sequence = 4; sequence <= 401; sequence += 1) {
      await operationalStore.execute({
        sql: 'INSERT INTO timeline_events(id,incident_id,tenant_id,sequence,type,category,actor_id,correlation_id,causation_id,payload_json,schema_version,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [
          `timeline-overflow-${sequence}`,
          'incident-1',
          'tenant-1',
          sequence,
          'incident.status_changed',
          'incident',
          null,
          'dashboard-overflow',
          null,
          '{"status":"investigating"}',
          1,
          '2026-08-28T18:01:00.000Z',
        ],
      });
    }
    const application = app(
      {
        ...sessionClient,
        authenticate: async () => ({
          userId: 'viewer-1',
          sessionId: 'session-1',
          organizationId: 'tenant-1',
          roles: ['viewer'] as string[],
        }),
      },
      operationalStore,
    );
    const stream = await application.request(
      'https://dashboard.test/api/incidents/incident-1/events?after=incident-1:200&resync=stream',
      { headers: { Cookie: cookie() } },
    );
    expect(stream.status).toBe(200);
    const first = await stream.body?.getReader().read();
    expect(new TextDecoder().decode(first?.value)).toContain('event: resync');
  });

  it('E2E mock SOC success: browser UI reaches CAS, reconciler, gateway, outcome, HTML and SSE', async () => {
    const plan = makePlan({
      createdAt: '2026-08-28T18:00:00.000Z',
      expiresAt: '2026-08-28T18:15:00.000Z',
    });
    const operationalStore = await approvalStore(plan);
    const workflow = trackedApprovalReconciler();
    const client = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'manager-1',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['soc_manager'] as string[],
      }),
      refresh: async () => ({
        kind: 'ok' as const,
        sealedSession: 'rotated',
        session: {
          userId: 'studio-soc-manager',
          sessionId: 'session-2',
          organizationId: 'tenant-1',
          roles: ['soc_manager'],
        },
      }),
    };
    const binding = await operationalStore.execute({
      sql: "SELECT a.plan_hash AS approval_hash, p.plan_hash AS stored_hash, i.version, i.current_run_id, a.workflow_run_id FROM approvals a JOIN containment_plans p ON p.id=a.plan_id JOIN incidents i ON i.id=a.incident_id WHERE a.id='approval-1'",
    });
    expect(binding.rows[0]).toMatchObject({
      approval_hash: plan.planHash,
      stored_hash: plan.planHash,
      current_run_id: 'run-1',
      workflow_run_id: 'run-1',
    });
    const submitted = await submitDashboardDecisionWithBundle(
      app(client, operationalStore, secret, workflow.reconcile),
      plan,
    );
    expect(submitted).toMatchObject({
      reloaded: false,
      error: { textContent: '' },
    });
    await expect(
      operationalStore.execute({
        sql: "SELECT decision FROM approvals WHERE id='approval-1'",
      }),
    ).resolves.toMatchObject({ rows: [{ decision: 'approved' }] });
    await transitionIncident(
      operationalStore,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        expectedVersion: 3,
        to: 'containing',
        runId: 'run-1',
        correlationId: 'dashboard-success',
        causationId: 'approval-1',
      },
      {
        clock: fixedClock('2026-08-28T18:03:00.000Z'),
        ids: sequenceIdGenerator(['containing-success', 'outbox-success']),
      },
    );
    const state = containmentState();
    const gateway = new ContainmentGateway({
      store: operationalStore,
      state,
      mode: 'local',
      timeoutMs: 1_000,
      rateLimit: 8,
      clock: fixedClock('2026-08-28T18:03:00.000Z'),
    });
    await gateway.executeApprovedAction({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      workflowRunId: 'run-1',
      approvalId: 'approval-1',
      plan,
      action: plan.actions[0]!,
    });
    await recordContainmentOutcome(
      operationalStore,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        correlationId: 'dashboard-success',
        approvalId: 'approval-1',
        expectedVersion: 4,
        status: 'contained',
        partial: false,
        completedCount: 1,
        failedCount: 0,
      },
      {
        clock: fixedClock('2026-08-28T18:04:00.000Z'),
        ids: sequenceIdGenerator(['contained-success', 'closed-success', 'outbox-contained', 'outbox-closed']),
      },
    );
    await transitionIncident(
      operationalStore,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        expectedVersion: 5,
        to: 'closed',
        runId: 'run-1',
        correlationId: 'dashboard-success-close',
        causationId: 'approval-1',
      },
      {
        clock: fixedClock('2026-08-28T18:04:01.000Z'),
        ids: sequenceIdGenerator(['closed-transition-success', 'outbox-closed-transition']),
      },
    );
    workflow.complete();
    await expect(
      workflow.reconcile({
        workflowRunId: 'run-1',
        resumeReceiptId: workflow.receiptId()!,
        expectedResultStatuses: ['contained'],
      }),
    ).resolves.toBe('completed');
    const application = app(client, operationalStore, secret, workflow.reconcile);
    const detail = await application.request('https://dashboard.test/api/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    await expect(detail.json()).resolves.toMatchObject({
      incident: { status: 'closed' },
      actions: [{ status: 'completed' }],
      approval: { decision: 'approved' },
    });
    const list = await application.request('https://dashboard.test/api/incidents', {
      headers: { Cookie: cookie() },
    });
    await expect(list.json()).resolves.toMatchObject({
      items: [{ incidentId: 'incident-1', status: 'closed' }],
    });
    const listPage = await application.request('https://dashboard.test/dashboard', {
      headers: { Cookie: cookie() },
    });
    await expect(listPage.text()).resolves.toContain('incident-1');
    const html = await application.request('https://dashboard.test/dashboard/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    await expect(html.text()).resolves.toContain('Decision and execution');
    const last = await operationalStore.execute({
      sql: "SELECT MAX(sequence) AS sequence FROM timeline_events WHERE incident_id='incident-1'",
    });
    const stream = await application.request(
      `https://dashboard.test/api/incidents/incident-1/events?after=incident-1:${Number(last.rows[0]?.sequence) - 1}`,
      { headers: { Cookie: cookie() } },
    );
    expect(stream.status).toBe(200);
    const chunk = await stream.body?.getReader().read();
    expect(new TextDecoder().decode(chunk?.value)).toContain('incident.status_changed');
  });

  it('E2E mock SOC partial/retry: dashboard projects the authoritative approval and containment recovery', async () => {
    const first = makePlan().actions[0]!;
    const second = {
      ...first,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({
      createdAt: '2026-08-28T18:00:00.000Z',
      expiresAt: '2026-08-28T18:15:00.000Z',
      actions: [first, second],
    });
    const operationalStore = await approvalStore(plan);
    const workflow = trackedApprovalReconciler();
    const client = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'studio-soc-manager',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['soc_manager'] as string[],
      }),
      refresh: async () => ({
        kind: 'ok' as const,
        sealedSession: 'rotated',
        session: {
          userId: 'studio-soc-manager',
          sessionId: 'session-2',
          organizationId: 'tenant-1',
          roles: ['soc_manager'],
        },
      }),
    };
    const application = app(client, operationalStore, secret, workflow.reconcile);
    const decision = await application.request('https://dashboard.test/api/incidents/incident-1/approvals', {
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
        'X-CSRF-Token': createCsrfToken(secret, {
          sessionId: 'session-1',
          tenantId: 'tenant-1',
        }),
      },
      body: JSON.stringify({
        decision: 'approved',
        planId: plan.planId,
        planHashVersion: 1,
        planHash: plan.planHash,
      }),
    });
    if (decision.status !== 200) throw new Error(await decision.text());
    await expect(decision.json()).resolves.toMatchObject({
      approvalId: 'approval-1',
      decision: 'approved',
      resumed: false,
    });
    expect(workflow.receiptId()).toBeTruthy();

    await transitionIncident(
      operationalStore,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        expectedVersion: 3,
        to: 'containing',
        runId: 'run-1',
        correlationId: 'dashboard-partial',
        causationId: 'approval-1',
      },
      {
        clock: fixedClock('2026-08-28T18:03:00.000Z'),
        ids: sequenceIdGenerator(['containing-timeline', 'containing-outbox']),
      },
    );
    const state = containmentState();
    state.failActions = new Set([second.actionId]);
    const gateway = new ContainmentGateway({
      store: operationalStore,
      state,
      mode: 'local',
      timeoutMs: 1_000,
      rateLimit: 8,
      clock: fixedClock('2026-08-28T18:03:00.000Z'),
    });
    await gateway.executeApprovedAction({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      workflowRunId: 'run-1',
      approvalId: 'approval-1',
      plan,
      action: first,
    });
    await gateway.executeApprovedAction({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      workflowRunId: 'run-1',
      approvalId: 'approval-1',
      plan,
      action: second,
    });
    await recordContainmentOutcome(
      operationalStore,
      {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        correlationId: 'dashboard-partial',
        approvalId: 'approval-1',
        expectedVersion: 4,
        status: 'failed',
        partial: true,
        completedCount: 1,
        failedCount: 1,
      },
      {
        clock: fixedClock('2026-08-28T18:03:00.000Z'),
        ids: sequenceIdGenerator(['failed-timeline', 'failed-outbox']),
      },
    );
    expect(state.calls.get(first.actionId)).toBe(1);
    expect(state.calls.get(second.actionId)).toBe(1);
    await expect(
      operationalStore.execute({
        sql: "SELECT status FROM incidents WHERE id = 'incident-1'",
      }),
    ).resolves.toMatchObject({ rows: [{ status: 'failed' }] });

    state.failActions.clear();
    await expect(
      retryPartialContainment(
        operationalStore,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          correlationId: 'dashboard-partial-retry',
          state,
          mode: 'local',
          timeoutMs: 1_000,
          rateLimit: 8,
        },
        {
          clock: fixedClock('2026-08-28T18:04:00.000Z'),
        },
      ),
    ).resolves.toMatchObject({ status: 'contained' });
    expect(state.calls.get(first.actionId)).toBe(1);
    expect(state.calls.get(second.actionId)).toBe(2);

    workflow.complete();
    await expect(
      workflow.reconcile({
        workflowRunId: 'run-1',
        resumeReceiptId: workflow.receiptId()!,
        expectedResultStatuses: ['contained'],
      }),
    ).resolves.toBe('completed');

    const detailResponse = await application.request('https://dashboard.test/api/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    if (detailResponse.status !== 200) throw new Error(await detailResponse.text());
    const detail = (await detailResponse.json()) as Awaited<ReturnType<typeof readDashboardIncident>>;
    expect(detail).toMatchObject({
      incident: { incidentId: 'incident-1', status: 'closed' },
      approval: { approvalId: 'approval-1', decision: 'approved' },
      actions: [
        { actionId: first.actionId, status: 'completed' },
        { actionId: second.actionId, status: 'completed' },
      ],
    });
    expect(detail.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'containment.completed',
          payloadRedacted: expect.objectContaining({
            status: 'contained',
          }),
        }),
        expect.objectContaining({
          type: 'incident.status_changed',
        }),
      ]),
    );
    const list = await application.request('https://dashboard.test/api/incidents', {
      headers: { Cookie: cookie() },
    });
    await expect(list.json()).resolves.toMatchObject({
      items: [{ incidentId: 'incident-1', status: 'closed' }],
    });
    const listPage = await application.request('https://dashboard.test/dashboard', {
      headers: { Cookie: cookie() },
    });
    await expect(listPage.text()).resolves.toContain('incident-1');
    const dashboard = await application.request('https://dashboard.test/dashboard/incidents/incident-1', {
      headers: { Cookie: cookie() },
    });
    expect(dashboard.status).toBe(200);
    const dashboardHtml = await dashboard.text();
    expect(dashboardHtml).toContain('Unclassified severity');
    expect(dashboardHtml).toContain('Closed');

    const sequenceResult = await operationalStore.execute({
      sql: "SELECT MAX(sequence) AS sequence FROM timeline_events WHERE incident_id = 'incident-1'",
    });
    const finalSequence = Number(sequenceResult.rows[0]?.sequence);
    const stream = await application.request('https://dashboard.test/api/incidents/incident-1/events', {
      headers: {
        Cookie: cookie(),
        'Last-Event-ID': `incident-1:${finalSequence - 1}`,
      },
    });
    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    const reader = stream.body?.getReader();
    if (!reader) throw new Error('SSE body missing');
    const chunk = await reader.read();
    await reader.cancel();
    const event = new TextDecoder().decode(chunk.value);
    expect(event).toContain(`id: incident-1:${finalSequence}`);
    expect(event).toContain('incident.status_changed');
  });

  it('E2E mock SOC failure/retry: stale decision is rejected with zero new authority effect', async () => {
    const operationalStore = await approvalStore();
    const client = {
      ...sessionClient,
      authenticate: async () => ({
        userId: 'manager-1',
        sessionId: 'session-1',
        organizationId: 'tenant-1',
        roles: ['soc_manager'] as string[],
      }),
      refresh: async () => ({
        kind: 'ok' as const,
        sealedSession: 'rotated',
        session: {
          userId: 'manager-1',
          sessionId: 'session-2',
          organizationId: 'tenant-1',
          roles: ['soc_manager'],
        },
      }),
    };
    const plan = makePlan({
      createdAt: '2026-08-28T18:00:00.000Z',
      expiresAt: '2026-08-28T18:15:00.000Z',
    });
    const response = await app(client, operationalStore, secret).request(
      'https://dashboard.test/api/incidents/incident-1/approvals',
      {
        method: 'POST',
        headers: {
          Cookie: cookie(),
          Origin: 'https://dashboard.test',
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          'X-CSRF-Token': createCsrfToken(secret, {
            sessionId: 'session-1',
            tenantId: 'tenant-1',
          }),
        },
        body: JSON.stringify({
          decision: 'approved',
          planId: plan.planId,
          planHashVersion: 1,
          planHash: '0'.repeat(64),
        }),
      },
    );
    expect(response.status).toBe(409);
    const row = await operationalStore.execute({
      sql: "SELECT decision FROM approvals WHERE id='approval-1'",
    });
    expect(row.rows[0]?.decision).toBeNull();
  });
  it('E2E mock 1: login callback redirects an authenticated user to the dashboard', async () => {
    const application = app();
    const login = await application.request('https://dashboard.test/auth/login');
    const stateCookie = login.headers.get('set-cookie')!;
    const token = /__Host-authkit-pkce=([^;]+)/u.exec(stateCookie)?.[1];
    const state = openPkceState(secret, token, now)!;
    const callback = await application.request(
      `https://dashboard.test/auth/callback?code=code_123&state=${state.state}`,
      { headers: { Cookie: stateCookie } },
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/dashboard');
  });

  it('automatically activates the only approved organization and redirects', async () => {
    const singleOrg: DashboardSessionClient = {
      ...sessionClient,
      completeLogin: async () => ({
        sealedSession: 'sealed',
        session: {
          userId: 'user_123',
          sessionId: 'session_123',
          organizationId: undefined,
          roles: [],
        },
      }),
      listOrganizations: async () => [
        {
          organizationId: 'tenant_456',
          organizationName: 'Only tenant',
          role: 'soc_manager',
        },
      ],
      refresh: async () => ({
        kind: 'ok',
        sealedSession: 'rotated',
        session: {
          userId: 'user_123',
          sessionId: 'session_456',
          organizationId: 'tenant_456',
          roles: ['soc_manager'],
        },
      }),
    };
    const application = app(singleOrg);
    const login = await application.request('https://dashboard.test/auth/login');
    const stateCookie = login.headers.get('set-cookie')!;
    const state = openPkceState(secret, /__Host-authkit-pkce=([^;]+)/u.exec(stateCookie)?.[1], now)!;
    const callback = await application.request(
      `https://dashboard.test/auth/callback?code=code_123&state=${state.state}`,
      { headers: { Cookie: stateCookie } },
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/dashboard');
    expect(callback.headers.get('set-cookie')).toContain('__Host-authkit-session=rotated');
  });

  it('E2E mock 2: a multi-org callback requires explicit CSRF-protected selection', async () => {
    const multiOrg: DashboardSessionClient = {
      ...sessionClient,
      completeLogin: async () => ({
        sealedSession: 'sealed',
        session: {
          userId: 'user_123',
          sessionId: 'session_123',
          organizationId: undefined,
          roles: [],
        },
      }),
      authenticate: async sealed =>
        sealed === 'rotated'
          ? {
              userId: 'user_123',
              sessionId: 'session_456',
              organizationId: 'tenant_456',
              roles: ['soc_manager'],
            }
          : {
              userId: 'user_123',
              sessionId: 'session_123',
              organizationId: undefined,
              roles: [],
            },
      listOrganizations: async () => [
        {
          organizationId: 'tenant_456',
          organizationName: 'Second tenant',
          role: 'soc_manager',
        },
        {
          organizationId: 'tenant_789',
          organizationName: 'Third tenant',
          role: 'viewer',
        },
      ],
      refresh: async () => ({
        kind: 'ok',
        sealedSession: 'rotated',
        session: {
          userId: 'user_123',
          sessionId: 'session_456',
          organizationId: 'tenant_456',
          roles: ['soc_manager'],
        },
      }),
    };
    const application = app(multiOrg);
    const login = await application.request('https://dashboard.test/auth/login');
    const stateCookie = login.headers.get('set-cookie')!;
    const state = openPkceState(secret, /__Host-authkit-pkce=([^;]+)/u.exec(stateCookie)?.[1], now)!;
    const callback = await application.request(
      `https://dashboard.test/auth/callback?code=code_123&state=${state.state}`,
      { headers: { Cookie: stateCookie } },
    );
    const html = await callback.text();
    const csrf = /name="csrfToken" value="([^"]+)"/u.exec(html)?.[1] ?? '';
    expect(csrf).not.toBe('');
    expect(html).toContain('Second tenant');
    const chosen = await application.request('https://dashboard.test/auth/organization', {
      redirect: 'manual',
      method: 'POST',
      headers: {
        Cookie: cookie(),
        Origin: 'https://dashboard.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        organizationId: 'tenant_456',
        csrfToken: csrf,
      }),
    });
    expect(chosen.status).toBe(303);
    expect(chosen.headers.get('location')).toBe('/dashboard');
    expect(chosen.headers.get('set-cookie')).toContain('__Host-authkit-session=rotated');
    const dashboard = await application.request('https://dashboard.test/dashboard', {
      headers: {
        Cookie: `__Host-authkit-session=rotated; __Host-authkit-issued-at=${sealSessionIssuedAt(secret, now)}`,
      },
    });
    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain('Tenant: tenant_456');
  });

  it('keeps the self-only dashboard CSP on detail pages', async () => {
    const response = await app().request('https://dashboard.test/dashboard/incidents/incident_123', {
      headers: { Cookie: cookie() },
    });
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(response.headers.get('content-security-policy')).not.toBe("default-src 'none'");
  });

  it('returns a client error for invalid cursors and resyncs nonexistent SSE incidents', async () => {
    const application = app();
    const invalidCursor = await application.request('https://dashboard.test/api/incidents?cursor=not-a-cursor', {
      headers: { Cookie: cookie() },
    });
    expect(invalidCursor.status).toBe(422);
    const stream = await application.request('https://dashboard.test/api/incidents/incident_123/events', {
      headers: { Cookie: cookie() },
    });
    expect(stream.status).toBe(404);
  });

  it('preserves a transient AuthKit failure as a retryable 503', async () => {
    const response = await app({
      ...sessionClient,
      authenticate: async () => {
        throw new Error('temporary JWKS failure');
      },
    }).request('https://dashboard.test/api/incidents', {
      headers: { Cookie: cookie() },
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE',
      retryable: true,
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

/** @jsxImportSource hono/jsx */
import type { Context, Hono } from 'hono';
import * as React from 'hono/jsx';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';

import { dashboardCookies } from '../auth/cookies.js';

import { createCsrfToken, hasCrossSiteMutationEvidence, isSameOriginMutation, verifyCsrfToken } from '../auth/csrf.js';
import { resolveDashboardPrincipal, type DashboardPrincipal } from '../auth/dashboard-principal.js';
import { openPkceState, safeDashboardNext, sealPkceState } from '../auth/pkce-state.js';
import { safeWorkosRedirect, type DashboardSessionClient } from '../auth/workos-session.js';
import { openSessionIssuedAt, sealSessionIssuedAt } from '../auth/session-lifetime.js';
import type { ReconcileApprovalRun } from '../../approval/workflow-resume-reconciler.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError } from '../../domain/errors.js';
import type { ApprovalConfig, DashboardConfig } from '../../env.js';
import type { AppEnv } from '../../http-context.js';
import type { StructuredLogger } from '../../logging.js';
import {
  DashboardDecisionRequestSchema,
  DashboardDeviceAuthorizationRequestSchema,
  DashboardManualReviewRequestSchema,
  IncidentListQuerySchema,
} from './contracts.js';
import { decideDeviceAuthorization } from '../../db/device-trust-operations.js';
import { decideDashboardApproval } from './approval.js';
import { decideDashboardManualReview } from './manual-review.js';
import { dashboardCss, dashboardJs } from './assets.js';
import { listDashboardIncidents, readDashboardIncident, readDashboardStatistics } from './queries.js';
import { sseResyncResponse, sseResponse, validateSseReplay } from './sse.js';
import {
  DashboardShell,
  DashboardUnavailable,
  IncidentDetail,
  IncidentList,
  LoginPage,
  OrganizationPicker,
} from './views.js';

// `node --import tsx`, used by `npm run dev`, currently lowers this file to
// the classic React.createElement form even though tsc honors jsxImportSource.
// Keep the Hono JSX runtime in lexical scope for both development and builds.
void React;

const logoutCsrfScope = 'dashboard-logout';
const defaultAuthMutationMaxBodyBytes = 1_048_576;
type DashboardDependencies = Readonly<{
  store: OperationalStore;
  logger: StructuredLogger;
  config: DashboardConfig;
  approvalConfig: ApprovalConfig;
  sessionClient: DashboardSessionClient | null;
  reconcileApprovalRun: ReconcileApprovalRun;
  authMutationMaxBodyBytes?: number;
  nowMs?: () => number;
}>;

export function registerDashboardRoutes(app: Hono<AppEnv>, dependencies: DashboardDependencies): void {
  const cookies = dashboardCookies(dependencies.config.dashboardOrigin);
  const nowMs = dependencies.nowMs ?? Date.now;
  const authMutationBodyLimit = bodyLimit({
    maxSize: dependencies.authMutationMaxBodyBytes ?? defaultAuthMutationMaxBodyBytes,
    onError: context => dashboardError(context, 'PAYLOAD_TOO_LARGE', 413),
  });
  const activeSse = new Map<string, number>();
  const rateWindows = new Map<string, { startedAt: number; count: number }>();
  const clientKey = (context: Context<AppEnv>) => {
    if (!dependencies.config.trustedProxy) return 'direct';
    const forwarded = context.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded && /^[0-9a-f:.]{1,64}$/iu.test(forwarded) ? forwarded : 'proxy-unknown';
  };
  const limited = (context: Context<AppEnv>, bucket: string, max: number) => {
    const client = clientKey(context);
    const key = `${bucket}:${client}`;
    const now = nowMs();
    for (const [candidate, value] of rateWindows) if (now - value.startedAt >= 60_000) rateWindows.delete(candidate);
    if (rateWindows.size >= 1024 && !rateWindows.has(key)) rateWindows.delete(rateWindows.keys().next().value!);
    const window = rateWindows.get(key);
    if (!window || now - window.startedAt >= 60_000) {
      rateWindows.set(key, { startedAt: now, count: 1 });
      return false;
    }
    window.count += 1;
    if (window.count > max) {
      context.header('Retry-After', String(Math.ceil((60_000 - (now - window.startedAt)) / 1000)));
      return true;
    }
    return false;
  };
  app.get('/assets/dashboard.css', context => {
    // Stable URLs must revalidate; immutable caching is safe only for
    // content-addressed paths.
    context.header('Cache-Control', 'public, max-age=0, must-revalidate');
    context.header('Content-Type', 'text/css; charset=utf-8');
    return context.body(dashboardCss);
  });
  app.get('/assets/dashboard.js', context => {
    context.header('Cache-Control', 'public, max-age=0, must-revalidate');
    context.header('Content-Type', 'application/javascript; charset=utf-8');
    return context.body(dashboardJs);
  });
  app.get('/auth/login', context =>
    limited(context, 'auth', 20)
      ? dashboardError(context, 'RATE_LIMITED', 429, true)
      : login(context, dependencies, 'sign-in', nowMs),
  );
  app.get('/auth/register', context =>
    limited(context, 'auth', 20)
      ? dashboardError(context, 'RATE_LIMITED', 429, true)
      : login(context, dependencies, 'sign-up', nowMs),
  );
  app.get('/auth/callback', async context => {
    if (limited(context, 'auth-callback', 30)) return dashboardError(context, 'RATE_LIMITED', 429, true);
    const client = dependencies.sessionClient;
    const secret = dependencies.config.csrfSecret;
    const state = openPkceState(secret ?? '', getCookie(context, cookies.state), nowMs());
    const code = context.req.query('code');
    if (!client || !secret || !state || !code || context.req.query('state') !== state.state)
      return dashboardError(context, 'AUTH_CALLBACK_INVALID', 400);
    let completed;
    try {
      completed = await client.completeLogin({
        code,
        codeVerifier: state.verifier,
      });
    } catch (error) {
      if (isTerminalAuthError(error)) {
        clearPkceState(context, dependencies.config);
        return dashboardError(context, 'AUTH_CALLBACK_INVALID', 400);
      }
      context.header('Retry-After', '3');
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
    clearPkceState(context, dependencies.config);
    try {
      setSessionCookie(
        context,
        dependencies.config,
        completed.sealedSession,
        dependencies.config.sessionMaxAgeSeconds,
        nowMs(),
        true,
        dependencies.config.csrfSecret!,
      );
      const principal = resolveDashboardPrincipal(completed.session);
      if (!principal) {
        const organizations = await client.listOrganizations(completed.session.userId);
        if (organizations.length === 1) {
          const organization = organizations[0]!;
          const refreshed = await client.refresh(completed.sealedSession, organization.organizationId);
          const selectedPrincipal = refreshed.kind === 'ok' ? resolveDashboardPrincipal(refreshed.session) : null;
          if (
            refreshed.kind !== 'ok' ||
            !selectedPrincipal ||
            selectedPrincipal.organizationId !== organization.organizationId
          ) {
            if (refreshed.kind === 'terminal') clearSessionCookies(context, dependencies.config);
            return dashboardError(context, 'ACCESS_DENIED', 403);
          }
          setSessionCookie(
            context,
            dependencies.config,
            refreshed.sealedSession,
            dependencies.config.sessionMaxAgeSeconds,
            nowMs(),
            false,
            dependencies.config.csrfSecret!,
          );
          dependencies.logger.write({
            event: 'dashboard.auth.login',
            requestId: context.get('requestId'),
          });
          return context.redirect(state.next, 302);
        }
        const csrfToken = createCsrfToken(secret, {
          sessionId: completed.session.sessionId,
          tenantId: 'organization-selection',
        });
        return context.html(<OrganizationPicker organizations={organizations} csrfToken={csrfToken} />);
      }
      dependencies.logger.write({
        event: 'dashboard.auth.login',
        requestId: context.get('requestId'),
      });
      return context.redirect(state.next, 302);
    } catch {
      context.header('Retry-After', '3');
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
  });
  // These form mutations are intentionally outside `/api/*`, so they need the
  // same bounded-body boundary before they read cookies, CSRF, or form data.
  app.use('/auth/logout', authMutationBodyLimit);
  app.get('/auth/logout', context => {
    context.header('Allow', 'POST');
    return dashboardError(context, 'METHOD_NOT_ALLOWED', 405);
  });
  app.post('/auth/logout', async context => {
    const submittedSession = getCookie(context, cookies.session);
    const body = await context.req.parseBody();
    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : undefined;
    const sameOrigin = isSameOriginMutation(context.req.raw, dependencies.config.dashboardOrigin);
    const crossSite = hasCrossSiteMutationEvidence(context.req.raw, dependencies.config.dashboardOrigin);
    const csrfValid = Boolean(
      submittedSession &&
      dependencies.config.csrfSecret &&
      verifyCsrfToken(dependencies.config.csrfSecret, {
        sessionId: submittedSession,
        tenantId: logoutCsrfScope,
        token: csrfToken,
      }),
    );
    if (crossSite || (!sameOrigin && !csrfValid)) return dashboardError(context, 'CSRF_VALIDATION_FAILED', 403);
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded) {
      // Logout remains recoverable when the WorkOS session expired or a local
      // cookie became stale. Same-origin enforcement prevents cross-site
      // navigation from turning this into a logout endpoint.
      clearSessionCookies(context, dependencies.config);
      return context.redirect('/dashboard', 303);
    }
    if (!csrfValid)
      dependencies.logger.write({
        event: 'dashboard.auth.logout.stale_csrf',
        requestId: context.get('requestId'),
        errorCode: 'CSRF_VALIDATION_FAILED',
      });
    clearSessionCookies(context, dependencies.config);
    dependencies.logger.write({
      event: 'dashboard.auth.logout',
      requestId: context.get('requestId'),
    });
    const logoutUrl = await dependencies.sessionClient
      ?.getLogoutUrl(loaded.principal.sessionRef, `${dependencies.config.dashboardOrigin}/`)
      .catch(() => null);
    const safeLogoutUrl = safeWorkosRedirect(logoutUrl);
    return safeLogoutUrl ? context.redirect(safeLogoutUrl, 302) : context.redirect('/dashboard', 303);
  });
  app.use('/auth/organization', authMutationBodyLimit);
  app.post('/auth/organization', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    const body = await context.req.parseBody();
    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : undefined;
    const sealedSession = loaded?.sealedSession ?? getCookie(context, cookies.session);
    const pending =
      !loaded && sealedSession && dependencies.sessionClient
        ? await dependencies.sessionClient.authenticate(sealedSession).catch(() => null)
        : null;
    const csrfPrincipal = loaded?.principal;
    const csrfValid = csrfPrincipal
      ? requireCsrf(context, dependencies, csrfPrincipal, csrfToken)
      : Boolean(
          pending &&
          dependencies.config.csrfSecret &&
          isSameOriginMutation(context.req.raw, dependencies.config.dashboardOrigin) &&
          verifyCsrfToken(dependencies.config.csrfSecret, {
            sessionId: pending.sessionId,
            tenantId: 'organization-selection',
            token: csrfToken,
          }),
        );
    if (!sealedSession || !csrfValid) return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(organizationId))
      return dashboardError(context, 'VALIDATION_FAILED', 422);
    let refreshed;
    try {
      refreshed = await dependencies.sessionClient?.refresh(sealedSession, organizationId);
    } catch (error) {
      if (isTerminalAuthError(error)) {
        clearSessionCookies(context, dependencies.config);
        return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
      }
      context.header('Retry-After', '3');
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
    const switchedPrincipal = refreshed?.kind === 'ok' ? resolveDashboardPrincipal(refreshed.session) : null;
    if (
      !refreshed ||
      refreshed.kind !== 'ok' ||
      !switchedPrincipal ||
      switchedPrincipal.organizationId !== organizationId
    ) {
      if (refreshed?.kind === 'terminal') {
        clearSessionCookies(context, dependencies.config);
        return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
      }
      return dashboardError(context, 'ACCESS_DENIED', 403);
    }
    setSessionCookie(
      context,
      dependencies.config,
      refreshed.sealedSession,
      dependencies.config.sessionMaxAgeSeconds,
      nowMs(),
      false,
      dependencies.config.csrfSecret,
    );
    return context.redirect('/dashboard', 303);
  });
  app.get('/', async context => dashboardPage(context, dependencies));
  app.get('/dashboard', async context => dashboardPage(context, dependencies));
  app.get('/dashboard/incidents/:incidentId', async context =>
    dashboardDetailPage(context, dependencies, context.req.param('incidentId')),
  );
  app.get('/api/incidents', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded) return authenticationFailure(context);
    const parsed = IncidentListQuerySchema.safeParse(context.req.query());
    if (!parsed.success) return dashboardError(context, 'VALIDATION_FAILED', 422);
    try {
      return context.json(
        await listDashboardIncidents(dependencies.store, {
          tenantId: loaded.principal.tenantId,
          cursorSecret: dependencies.config.csrfSecret!,
          ...parsed.data,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'DomainError')
        return dashboardError(context, 'VALIDATION_FAILED', 422);
      return dashboardError(context, 'STORAGE_UNAVAILABLE', 503, true);
    }
  });
  app.get('/api/incidents/:incidentId', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded) return authenticationFailure(context);
    try {
      return context.json(
        await readDashboardIncident(dependencies.store, {
          tenantId: loaded.principal.tenantId,
          incidentId: context.req.param('incidentId'),
        }),
      );
    } catch (error) {
      return dashboardError(
        context,
        error instanceof Error && error.name === 'DomainError' ? 'NOT_FOUND' : 'STORAGE_UNAVAILABLE',
        error instanceof Error && error.name === 'DomainError' ? 404 : 503,
        !(error instanceof Error && error.name === 'DomainError'),
      );
    }
  });
  app.post('/api/incidents/:incidentId/approvals', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded || !requireCsrf(context, dependencies, loaded.principal))
      return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    if (loaded.principal.role !== 'soc_manager') {
      dependencies.logger.write({
        event: 'dashboard.rbac.denied',
        requestId: context.get('requestId'),
        correlationId: context.get('correlationId'),
        incidentId: context.req.param('incidentId'),
        errorCode: 'ROLE_REQUIRED',
        status: 403,
      });
      return dashboardError(context, 'ACCESS_DENIED', 403);
    }
    if (limited(context, `decision:${loaded.principal.sessionRef}`, 12))
      return dashboardError(context, 'RATE_LIMITED', 429, true);
    let refreshed;
    try {
      refreshed = await dependencies.sessionClient?.refresh(loaded.sealedSession, loaded.principal.organizationId);
    } catch (error) {
      if (isTerminalAuthError(error)) {
        clearSessionCookies(context, dependencies.config);
        return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
      }
      context.header('Retry-After', '3');
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
    const principal = refreshed?.kind === 'ok' ? resolveDashboardPrincipal(refreshed.session) : null;
    if (!refreshed || refreshed.kind !== 'ok' || !principal) {
      if (refreshed?.kind === 'terminal') clearSessionCookies(context, dependencies.config);
      return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    }
    setSessionCookie(
      context,
      dependencies.config,
      refreshed.sealedSession,
      dependencies.config.sessionMaxAgeSeconds,
      nowMs(),
      false,
      dependencies.config.csrfSecret,
    );
    const body = DashboardDecisionRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!body.success) return dashboardError(context, 'VALIDATION_FAILED', 422);
    try {
      return context.json(
        await decideDashboardApproval({
          store: dependencies.store,
          approvalConfig: dependencies.approvalConfig,
          principal,
          incidentId: context.req.param('incidentId'),
          body: body.data,
          correlationId: context.get('correlationId'),
          reconcileApprovalRun: dependencies.reconcileApprovalRun,
          clock: { now: () => new Date(nowMs()).toISOString() },
        }),
      );
    } catch (error) {
      return dashboardError(
        context,
        error instanceof DomainError ? 'DECISION_REJECTED' : 'STORAGE_UNAVAILABLE',
        error instanceof DomainError ? 409 : 503,
        !(error instanceof DomainError),
      );
    }
  });
  app.post('/api/incidents/:incidentId/device-authorization', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded || !requireCsrf(context, dependencies, loaded.principal))
      return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    if (loaded.principal.role !== 'soc_manager') return dashboardError(context, 'ACCESS_DENIED', 403);
    if (limited(context, `device-auth:${loaded.principal.sessionRef}`, 12))
      return dashboardError(context, 'RATE_LIMITED', 429, true);
    let refreshed;
    try {
      refreshed = await dependencies.sessionClient?.refresh(loaded.sealedSession, loaded.principal.organizationId);
    } catch {
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
    const principal = refreshed?.kind === 'ok' ? resolveDashboardPrincipal(refreshed.session) : null;
    if (!refreshed || refreshed.kind !== 'ok' || !principal || principal.role !== 'soc_manager')
      return dashboardError(context, 'ACCESS_DENIED', 403);
    setSessionCookie(
      context,
      dependencies.config,
      refreshed.sealedSession,
      dependencies.config.sessionMaxAgeSeconds,
      nowMs(),
      false,
      dependencies.config.csrfSecret,
    );
    const body = DashboardDeviceAuthorizationRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!body.success) return dashboardError(context, 'VALIDATION_FAILED', 422);
    try {
      return context.json(
        await decideDeviceAuthorization(dependencies.store, {
          tenantId: principal.tenantId,
          incidentId: context.req.param('incidentId'),
          actorId: principal.userRef,
          actorRole: 'soc_manager',
          ...body.data,
          occurredAt: new Date(nowMs()).toISOString(),
        }),
      );
    } catch (error) {
      return dashboardError(
        context,
        error instanceof DomainError ? 'DECISION_REJECTED' : 'STORAGE_UNAVAILABLE',
        error instanceof DomainError ? 409 : 503,
        !(error instanceof DomainError),
      );
    }
  });
  app.post('/api/incidents/:incidentId/manual-review', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded || !requireCsrf(context, dependencies, loaded.principal))
      return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    if (loaded.principal.role === 'viewer') {
      dependencies.logger.write({
        event: 'dashboard.rbac.denied',
        requestId: context.get('requestId'),
        correlationId: context.get('correlationId'),
        incidentId: context.req.param('incidentId'),
        errorCode: 'ROLE_REQUIRED',
        status: 403,
      });
      return dashboardError(context, 'ACCESS_DENIED', 403);
    }
    if (limited(context, `manual-review:${loaded.principal.sessionRef}`, 12))
      return dashboardError(context, 'RATE_LIMITED', 429, true);

    let refreshed;
    try {
      refreshed = await dependencies.sessionClient?.refresh(loaded.sealedSession, loaded.principal.organizationId);
    } catch (error) {
      if (isTerminalAuthError(error)) {
        clearSessionCookies(context, dependencies.config);
        return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
      }
      context.header('Retry-After', '3');
      return dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true);
    }
    const principal = refreshed?.kind === 'ok' ? resolveDashboardPrincipal(refreshed.session) : null;
    if (!refreshed || refreshed.kind !== 'ok' || !principal) {
      if (refreshed?.kind === 'terminal') clearSessionCookies(context, dependencies.config);
      return dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
    }
    setSessionCookie(
      context,
      dependencies.config,
      refreshed.sealedSession,
      dependencies.config.sessionMaxAgeSeconds,
      nowMs(),
      false,
      dependencies.config.csrfSecret,
    );
    const body = DashboardManualReviewRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!body.success) return dashboardError(context, 'VALIDATION_FAILED', 422);
    try {
      return context.json(
        await decideDashboardManualReview({
          store: dependencies.store,
          principal,
          incidentId: context.req.param('incidentId'),
          body: body.data,
          correlationId: context.get('correlationId'),
          clock: { now: () => new Date(nowMs()).toISOString() },
        }),
      );
    } catch (error) {
      return dashboardError(
        context,
        error instanceof DomainError ? 'DECISION_REJECTED' : 'STORAGE_UNAVAILABLE',
        error instanceof DomainError ? 409 : 503,
        !(error instanceof DomainError),
      );
    }
  });
  app.get('/api/incidents/:incidentId/events', async context => {
    const loaded = await loadPrincipal(context, dependencies);
    if (!loaded) return authenticationFailure(context);
    const incidentId = context.req.param('incidentId');
    let replay;
    try {
      replay = await validateSseReplay(
        dependencies.store,
        loaded.principal,
        incidentId,
        // EventSource is forbidden from setting custom headers.  SSR supplies
        // the first cursor in `after`; browser reconnects prefer its native
        // Last-Event-ID header, which is checked by the same strict parser.
        context.req.header('Last-Event-ID') ?? context.req.query('after'),
      );
    } catch (error) {
      return dashboardError(
        context,
        error instanceof DomainError ? 'NOT_FOUND' : 'STORAGE_UNAVAILABLE',
        error instanceof DomainError ? 404 : 503,
        !(error instanceof DomainError),
      );
    }
    if (!replay)
      return context.req.query('resync') === 'stream'
        ? sseResyncResponse(context)
        : dashboardError(context, 'RESYNC_REQUIRED', 409);
    // Connection limits aggregate over the session and tenant.  Including the
    // incident in the key made the previous limit trivially bypassable.
    const sessionKey = `session:${loaded.principal.sessionRef}`;
    const tenantKey = `tenant:${loaded.principal.tenantId}`;
    const ipKey = `ip:${clientKey(context)}`;
    const sessionCount = activeSse.get(sessionKey) ?? 0;
    const tenantCount = activeSse.get(tenantKey) ?? 0;
    const ipCount = activeSse.get(ipKey) ?? 0;
    if (
      sessionCount >= dependencies.config.sseMaxConnections ||
      tenantCount >= dependencies.config.sseMaxConnections * 8 ||
      ipCount >= dependencies.config.sseMaxConnections * 8
    )
      return dashboardError(context, 'SSE_LIMIT_REACHED', 429);
    activeSse.set(sessionKey, sessionCount + 1);
    activeSse.set(tenantKey, tenantCount + 1);
    activeSse.set(ipKey, ipCount + 1);
    return sseResponse(context, {
      store: dependencies.store,
      principal: loaded.principal,
      incidentId,
      replay: replay.events,
      after: replay.after,
      release: () => {
        for (const key of [sessionKey, tenantKey, ipKey]) {
          const next = (activeSse.get(key) ?? 1) - 1;
          if (next <= 0) activeSse.delete(key);
          else activeSse.set(key, next);
        }
      },
    });
  });
}

async function login(
  context: Context<AppEnv>,
  dependencies: DashboardDependencies,
  intent: 'sign-in' | 'sign-up',
  nowMs: () => number,
) {
  const cookies = dashboardCookies(dependencies.config.dashboardOrigin);
  const client = dependencies.sessionClient;
  const secret = dependencies.config.csrfSecret;
  if (!client || !secret) return dashboardError(context, 'AUTH_CONFIGURATION_REQUIRED', 503, true);
  try {
    const started = await client.startLogin({ intent });
    const next = safeDashboardNext(context.req.query('next'));
    setCookie(
      context,
      cookies.state,
      sealPkceState(secret, {
        state: started.state,
        verifier: started.codeVerifier,
        next,
        issuedAtMs: nowMs(),
      }),
      { ...cookies.options, maxAge: 600 },
    );
    const authorizationUrl = safeWorkosRedirect(started.authorizationUrl);
    if (!authorizationUrl) return dashboardError(context, 'AUTH_CONFIGURATION_REQUIRED', 503, true);
    return context.redirect(authorizationUrl, 302);
  } catch {
    return dashboardError(context, 'AUTH_CONFIGURATION_REQUIRED', 503, true);
  }
}

async function dashboardPage(context: Context<AppEnv>, dependencies: DashboardDependencies) {
  const loaded = await loadPrincipal(context, dependencies);
  if (!loaded) return context.html(<LoginPage requestId={context.get('requestId')} />);
  const logoutCsrfToken = createCsrfToken(dependencies.config.csrfSecret!, {
    sessionId: loaded.sealedSession,
    tenantId: logoutCsrfScope,
  });
  const query = IncidentListQuerySchema.safeParse(context.req.query());
  if (!query.success) return dashboardError(context, 'VALIDATION_FAILED', 422);
  let data;
  let statistics;
  try {
    [data, statistics] = await dependencies.store.transaction(tx =>
      Promise.all([
        listDashboardIncidents(tx, {
          tenantId: loaded.principal.tenantId,
          cursorSecret: dependencies.config.csrfSecret!,
          ...query.data,
        }),
        readDashboardStatistics(tx, loaded.principal.tenantId),
      ]),
    );
  } catch {
    return context.html(
      <DashboardShell principal={loaded.principal} logoutCsrfToken={logoutCsrfToken}>
        <DashboardUnavailable message="Incident data could not be loaded. Retry this page." />
      </DashboardShell>,
      503,
    );
  }
  return context.html(
    <DashboardShell principal={loaded.principal} logoutCsrfToken={logoutCsrfToken}>
      <IncidentList
        data={data}
        statistics={statistics}
        filters={query.data}
        nextPageHref={data.page.nextCursor ? dashboardListHref(query.data, data.page.nextCursor) : null}
      />
    </DashboardShell>,
  );
}

function dashboardListHref(
  query: Readonly<{
    kind?: string;
    status?: string;
    severity?: string;
    limit: number;
  }>,
  cursor: string,
): string {
  const params = new URLSearchParams({ cursor, limit: String(query.limit) });
  for (const [key, value] of Object.entries(query)) if (key !== 'limit' && value) params.set(key, String(value));
  return `/dashboard?${params.toString()}`;
}

async function dashboardDetailPage(context: Context<AppEnv>, dependencies: DashboardDependencies, incidentId: string) {
  const loaded = await loadPrincipal(context, dependencies);
  if (!loaded) return context.html(<LoginPage requestId={context.get('requestId')} />);
  let detail;
  try {
    detail = await readDashboardIncident(dependencies.store, {
      tenantId: loaded.principal.tenantId,
      incidentId,
    });
  } catch (error) {
    if (!(error instanceof Error && error.name === 'DomainError')) {
      const logoutCsrfToken = createCsrfToken(dependencies.config.csrfSecret!, {
        sessionId: loaded.sealedSession,
        tenantId: logoutCsrfScope,
      });
      return context.html(
        <DashboardShell principal={loaded.principal} logoutCsrfToken={logoutCsrfToken}>
          <DashboardUnavailable message="Incident data could not be loaded. Retry this page." />
        </DashboardShell>,
        503,
      );
    }
    return dashboardError(context, 'NOT_FOUND', 404, false);
  }
  const csrfToken = createCsrfToken(dependencies.config.csrfSecret!, {
    sessionId: loaded.principal.sessionRef,
    tenantId: loaded.principal.tenantId,
  });
  const logoutCsrfToken = createCsrfToken(dependencies.config.csrfSecret!, {
    sessionId: loaded.sealedSession,
    tenantId: logoutCsrfScope,
  });
  return context.html(
    <DashboardShell principal={loaded.principal} logoutCsrfToken={logoutCsrfToken}>
      <IncidentDetail
        detail={detail}
        csrfToken={csrfToken}
        canDecide={loaded.principal.role === 'soc_manager'}
        canReview={loaded.principal.role !== 'viewer'}
      />
    </DashboardShell>,
  );
}

async function loadPrincipal(
  context: Context<AppEnv>,
  dependencies: DashboardDependencies,
): Promise<Readonly<{
  principal: DashboardPrincipal;
  sealedSession: string;
}> | null> {
  const cookies = dashboardCookies(dependencies.config.dashboardOrigin);
  const sealedSession = getCookie(context, cookies.session);
  if (!sealedSession || !dependencies.sessionClient) return null;
  if (
    !dependencies.config.csrfSecret ||
    !openSessionIssuedAt(
      dependencies.config.csrfSecret,
      getCookie(context, cookies.issuedAt),
      (dependencies.nowMs ?? Date.now)(),
      dependencies.config.sessionMaxAgeSeconds,
    )
  ) {
    clearSessionCookies(context, dependencies.config);
    return null;
  }
  try {
    let currentSealedSession = sealedSession;
    let session = await dependencies.sessionClient.authenticate(currentSealedSession);
    if (!session) {
      const refreshed = await dependencies.sessionClient.refresh(currentSealedSession);
      if (refreshed.kind === 'terminal') {
        clearSessionCookies(context, dependencies.config);
        return null;
      }
      session = refreshed.session;
      currentSealedSession = refreshed.sealedSession;
      setSessionCookie(
        context,
        dependencies.config,
        refreshed.sealedSession,
        dependencies.config.sessionMaxAgeSeconds,
        (dependencies.nowMs ?? Date.now)(),
        false,
        dependencies.config.csrfSecret,
      );
    }
    const principal = session ? resolveDashboardPrincipal(session) : null;
    if (!principal) {
      clearSessionCookies(context, dependencies.config);
      return null;
    }
    return { principal, sealedSession: currentSealedSession };
  } catch {
    // SDK/network exceptions are transient until an explicit terminal result.
    context.set('dashboardAuthTransient', true);
    context.header('Retry-After', '3');
    return null;
  }
}
function authenticationFailure(context: Context<AppEnv>) {
  return context.get('dashboardAuthTransient')
    ? dashboardError(context, 'AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503, true)
    : dashboardError(context, 'AUTHENTICATION_REQUIRED', 401);
}
function clearSessionCookies(context: Context<AppEnv>, config: DashboardConfig) {
  const cookies = dashboardCookies(config.dashboardOrigin);
  for (const name of [cookies.session, cookies.issuedAt]) deleteCookie(context, name, cookies.options);
}
function clearPkceState(context: Context<AppEnv>, config: DashboardConfig) {
  const cookies = dashboardCookies(config.dashboardOrigin);
  deleteCookie(context, cookies.state, cookies.options);
}
/** WorkOS exposes terminal OAuth input failures as `invalid_grant`/4xx. */
function isTerminalAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Readonly<{
    code?: unknown;
    error?: unknown;
    status?: unknown;
    statusCode?: unknown;
  }>;
  return (
    candidate.code === 'invalid_grant' ||
    candidate.error === 'invalid_grant' ||
    candidate.status === 400 ||
    candidate.status === 401 ||
    candidate.statusCode === 400 ||
    candidate.statusCode === 401
  );
}
function requireCsrf(
  context: Context<AppEnv>,
  dependencies: DashboardDependencies,
  principal: DashboardPrincipal,
  formToken?: string,
) {
  return (
    Boolean(dependencies.config.csrfSecret) &&
    isSameOriginMutation(context.req.raw, dependencies.config.dashboardOrigin) &&
    verifyCsrfToken(dependencies.config.csrfSecret!, {
      sessionId: principal.sessionRef,
      tenantId: principal.tenantId,
      token: context.req.header('X-CSRF-Token') ?? formToken,
    })
  );
}
function setSessionCookie(
  context: Context<AppEnv>,
  config: DashboardConfig,
  value: string,
  maxAge: number,
  nowMs = Date.now(),
  createLifetime = false,
  secret?: string,
) {
  const cookies = dashboardCookies(config.dashboardOrigin);
  const issuedAt = secret ? openSessionIssuedAt(secret, getCookie(context, cookies.issuedAt), nowMs, maxAge) : null;
  const effectiveIssuedAt = issuedAt ?? (createLifetime ? nowMs : nowMs);
  const remaining = Math.max(0, maxAge - Math.ceil((nowMs - effectiveIssuedAt) / 1000));
  if (secret && (createLifetime || !issuedAt))
    setCookie(context, cookies.issuedAt, sealSessionIssuedAt(secret, effectiveIssuedAt), {
      ...cookies.options,
      maxAge,
    });
  setCookie(context, cookies.session, value, {
    ...cookies.options,
    maxAge: remaining,
  });
}
function dashboardError(
  context: Context<AppEnv>,
  code: string,
  status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 422 | 429 | 503,
  retryable = false,
) {
  return context.json(
    {
      code,
      message: 'The dashboard request could not be completed.',
      requestId: context.get('requestId'),
      retryable,
    },
    status,
  );
}

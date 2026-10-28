/** @jsxImportSource hono/jsx */
import * as React from 'hono/jsx';
import type { FC } from 'hono/jsx';

import { WORKOS_DASHBOARD_ROLE_SLUGS, type DashboardPrincipal } from '../auth/dashboard-principal.js';
import type { DashboardOrganization } from '../auth/workos-session.js';
import type { listDashboardIncidents, readDashboardIncident, readDashboardStatistics } from './queries.js';

// See routes.tsx: the development loader emits classic JSX calls.
void React;

type DashboardIncidentDetail = Awaited<ReturnType<typeof readDashboardIncident>>;
type DashboardIncidentList = Awaited<ReturnType<typeof listDashboardIncidents>>;
type DashboardStatistics = Awaited<ReturnType<typeof readDashboardStatistics>>;

const INCIDENT_KIND_LABELS: Readonly<Record<string, string>> = {
  disallowed_country_login: 'Sign-in from an unusual country',
  country_login: 'Sign-in from an unusual country',
  'country-login': 'Sign-in from an unusual country',
  unauthorized_privilege_change: 'Unexpected privilege change',
  privilege_change: 'Unexpected privilege change',
  'privilege-change': 'Unexpected privilege change',
  unknown_device_login: 'Sign-in from an unknown device',
  unknown_device: 'Sign-in from an unknown device',
  'unknown-device': 'Sign-in from an unknown device',
};

const ACTION_LABELS: Readonly<Record<string, string>> = {
  require_reauthentication: 'Require reauthentication',
  revoke_session: 'Revoke suspicious session',
  revert_role_change: 'Revert privilege change',
  disable_user: 'Disable user access',
};

const EVENT_LABELS: Readonly<Record<string, string>> = {
  'incident.received': 'Alert received',
  'workflow.investigation_started': 'Investigation started',
  'evidence.persisted': 'Evidence collected',
  'evidence.correlated': 'Evidence correlated',
  'runbook.retrieved': 'Response runbook selected',
  'triage.classification.completed': 'Risk classified',
  'triage.summary.completed': 'Incident summary prepared',
  'triage.proposal.completed': 'Containment actions proposed',
  'triage.manual_review.decided': 'Manual review recorded',
  'approval.requested': 'Review requested',
  'approval.decided': 'Decision recorded',
  'containment.started': 'Containment started',
  'containment.completed': 'Containment completed',
  'incident.status_changed': 'Incident status updated',
};

const REVIEW_REASON_LABELS: Readonly<Record<string, string>> = {
  REQUIRED_EVIDENCE_MISSING: 'Required evidence is missing',
  REQUIRED_EVIDENCE_INCOMPLETE: 'Required evidence is incomplete',
  CONFIDENCE_BELOW_THRESHOLD: 'Evidence confidence is below the policy threshold',
  MATERIAL_CONTRADICTION: 'The available evidence contains a material contradiction',
  MODEL_DIVERGENCE: 'The model assessment diverged from the validated policy result',
  MODEL_SCHEMA_INVALID: 'The model response did not match the required structure',
  MODEL_UNAVAILABLE: 'The decision model was unavailable',
  TARGET_NOT_PROVEN: 'The affected target could not be proven',
  BENIGN_EXPLANATION: 'A possible benign explanation requires human validation',
};

function words(value: string) {
  return value.replaceAll(/[._-]+/gu, ' ').replaceAll(/\b\w/gu, letter => letter.toUpperCase());
}

function incidentKindLabel(value: string) {
  return INCIDENT_KIND_LABELS[value] ?? words(value);
}

function actionLabel(value: string) {
  return ACTION_LABELS[value] ?? words(value);
}

function eventLabel(value: string) {
  return EVENT_LABELS[value] ?? words(value);
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

function shortRef(value: string) {
  return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function evidenceGroups(items: DashboardIncidentDetail['evidence']) {
  const groups = new Map<
    string,
    {
      source: string;
      providers: Set<string>;
      count: number;
      available: number;
      confidence: number;
      observedAt: string;
    }
  >();
  for (const item of items) {
    const group = groups.get(item.source) ?? {
      source: item.source,
      providers: new Set<string>(),
      count: 0,
      available: 0,
      confidence: 0,
      observedAt: item.observedAt,
    };
    group.providers.add(item.provider);
    group.count += 1;
    if (item.state !== 'missing') group.available += 1;
    group.confidence += item.confidence;
    if (Date.parse(item.observedAt) > Date.parse(group.observedAt)) group.observedAt = item.observedAt;
    groups.set(item.source, group);
  }
  return [...groups.values()];
}

export const DashboardShell: FC<
  Readonly<{
    principal: DashboardPrincipal;
    logoutCsrfToken: string;
    children: unknown;
  }>
> = ({ principal, logoutCsrfToken, children }) => (
  <html>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>SOC dashboard</title>
      <link rel="stylesheet" href="/assets/dashboard.css" />
    </head>
    <body>
      <main>
        <header class="app-header">
          <div>
            <a class="brand" href="/dashboard" aria-label="Security operations home">
              <span class="brand-mark" aria-hidden="true">
                S
              </span>
              <span>
                <strong>Security operations</strong>
                <small>Incident triage</small>
              </span>
            </a>
          </div>
          <div class="account-bar">
            <span class="account-chip" title={principal.tenantId}>
              Tenant: {shortRef(principal.tenantId)}
            </span>
            <span class="role-chip">{words(principal.role)}</span>
            <form method="post" action="/auth/logout">
              <input type="hidden" name="csrfToken" value={logoutCsrfToken} />
              <button class="button button-quiet" type="submit">
                Log out
              </button>
            </form>
          </div>
        </header>
        {children}
        <script src="/assets/dashboard.js" />
      </main>
    </body>
  </html>
);

export const LoginPage: FC<Readonly<{ requestId: string }>> = ({ requestId }) => (
  <html>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Sign in · Security operations</title>
      <link rel="stylesheet" href="/assets/dashboard.css" />
    </head>
    <body class="auth-body">
      <main class="auth-main">
        <header class="auth-header">
          <a class="brand" href="/dashboard" aria-label="Security operations">
            <span class="brand-mark" aria-hidden="true">
              S
            </span>
            <span>
              <strong>Security operations</strong>
              <small>Incident triage</small>
            </span>
          </a>
          <span class="auth-environment">
            <span aria-hidden="true" /> Secure access
          </span>
        </header>

        <section class="auth-layout">
          <div class="auth-intro">
            <p class="eyebrow">Security incident triage and response</p>
            <h1>Turn security signals into accountable action.</h1>
            <p class="auth-lead">
              Investigate alerts, review evidence-backed containment plans, and keep every decision auditable from one
              focused workspace.
            </p>
            <div class="auth-capabilities" aria-label="Platform capabilities">
              <article>
                <span aria-hidden="true">01</span>
                <div>
                  <strong>Correlated evidence</strong>
                  <small>Identity, endpoint, and cloud context in one view.</small>
                </div>
              </article>
              <article>
                <span aria-hidden="true">02</span>
                <div>
                  <strong>Human-controlled response</strong>
                  <small>Containment remains gated by explicit approval.</small>
                </div>
              </article>
              <article>
                <span aria-hidden="true">03</span>
                <div>
                  <strong>Complete audit trail</strong>
                  <small>Evidence, runbooks, decisions, and outcomes stay linked.</small>
                </div>
              </article>
            </div>
          </div>

          <section class="auth-card" aria-labelledby="auth-heading">
            <div class="auth-card-icon" aria-hidden="true">
              <span />
            </div>
            <p class="eyebrow">Organization access</p>
            <h2 id="auth-heading">Welcome back</h2>
            <p class="auth-card-copy">Sign in to access your organization’s incidents and response queue.</p>
            <a class="button button-primary button-block" href="/auth/login">
              Continue with WorkOS <span aria-hidden="true">→</span>
            </a>
            <div class="auth-divider">
              <span>New to this workspace?</span>
            </div>
            <a class="button button-secondary button-block" href="/auth/register">
              Create an account
            </a>
            <p class="auth-security-note">
              Authentication is managed by WorkOS. Access requires membership in an approved organization and an
              authorized SOC role.
            </p>
          </section>
        </section>

        <footer class="auth-footer">
          <small>Evidence-backed triage · Approval-gated containment</small>
          <details>
            <summary>Request reference</summary>
            <code>{requestId}</code>
          </details>
        </footer>
      </main>
    </body>
  </html>
);

export const DashboardUnavailable: FC<Readonly<{ message: string }>> = ({ message }) => (
  <section class="card" role="alert" aria-live="assertive">
    <h2>Dashboard temporarily unavailable</h2>
    <p>{message}</p>
    <p>
      <a href="/dashboard">Retry dashboard</a>
    </p>
  </section>
);

export const OrganizationPicker: FC<
  Readonly<{
    organizations: readonly DashboardOrganization[];
    csrfToken: string;
  }>
> = ({ organizations, csrfToken }) => (
  <html>
    <head>
      <meta charSet="utf-8" />
      <title>Select organization</title>
      <link rel="stylesheet" href="/assets/dashboard.css" />
    </head>
    <body>
      <main>
        <h1>Select an organization</h1>
        {organizations.length ? (
          <form method="post" action="/auth/organization">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <label>
              Organization
              <select name="organizationId" required>
                {organizations.map(organization => (
                  <option value={organization.organizationId}>
                    {organization.organizationName} ({organization.role})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Continue</button>
          </form>
        ) : (
          <p role="status">
            This account has no active organization membership with an approved dashboard role. Assign exactly one of
            the following roles in WorkOS, then sign in again: {WORKOS_DASHBOARD_ROLE_SLUGS.join(', ')}.
          </p>
        )}
      </main>
    </body>
  </html>
);

export const IncidentList: FC<
  Readonly<{
    data: DashboardIncidentList;
    statistics: DashboardStatistics;
    filters: Readonly<{
      status?: string;
      severity?: string;
      kind?: string;
    }>;
    nextPageHref: string | null;
  }>
> = ({ data, statistics, filters, nextPageHref }) => {
  const cards = [
    {
      key: 'total',
      label: 'Total incidents',
      value: statistics.total,
      hint: 'All recorded incidents',
    },
    {
      key: 'open',
      label: 'Open',
      value: statistics.open,
      hint: 'Still in the response flow',
    },
    {
      key: 'awaiting-approval',
      label: 'Awaiting review',
      value: statistics.awaitingApproval,
      hint: 'Need a manager decision',
    },
    {
      key: 'high-priority',
      label: 'High priority',
      value: statistics.highPriority,
      hint: 'Open high or critical severity',
    },
  ] as const;

  return (
    <section class="dashboard-overview" aria-live="polite">
      <header class="page-header">
        <div>
          <h1>Incidents</h1>
        </div>
      </header>

      <div class="statistics-grid" aria-label="Incident statistics">
        {cards.map(card => (
          <article class="statistic-card" data-stat={card.key}>
            <div class="statistic-label">
              <span>{card.label}</span>
              <span class="statistic-dot" aria-hidden="true" />
            </div>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </div>

      <section class="incidents-section" aria-labelledby="incident-list-heading">
        <div class="list-heading">
          <div>
            <h2 id="incident-list-heading">Incident queue</h2>
            <p>
              {data.items.length} incident{data.items.length === 1 ? '' : 's'} on this page
            </p>
          </div>
          <form method="get" action="/dashboard" class="filter-bar" aria-label="Filter incidents">
            <label>
              <span>Status</span>
              <select name="status">
                <option value="">All statuses</option>
                {[
                  'received',
                  'investigating',
                  'awaiting_approval',
                  'approved',
                  'rejected',
                  'containing',
                  'contained',
                  'failed',
                  'closed',
                ].map(status => (
                  <option value={status} selected={filters.status === status}>
                    {words(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Severity</span>
              <select name="severity">
                <option value="">All severities</option>
                {['low', 'medium', 'high', 'critical'].map(severity => (
                  <option value={severity} selected={filters.severity === severity}>
                    {words(severity)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select name="kind">
                <option value="">All types</option>
                {['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login'].map(kind => (
                  <option value={kind} selected={filters.kind === kind}>
                    {incidentKindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>
            <button class="button button-secondary" type="submit">
              Apply
            </button>
            {filters.status || filters.severity || filters.kind ? (
              <a class="clear-filter" href="/dashboard">
                Clear
              </a>
            ) : null}
          </form>
        </div>

        <div class="incident-table">
          <div class="incident-table-header" aria-hidden="true">
            <span>Incident</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>
          {data.items.length ? (
            data.items.map(item => (
              <a class="incident-row" href={`/dashboard/incidents/${item.incidentId}`}>
                <span class="incident-identity">
                  <strong>{incidentKindLabel(item.kind)}</strong>
                  <code>{shortRef(item.incidentId)}</code>
                </span>
                <span>
                  <span class={`badge severity-${item.severity ?? 'unclassified'}`}>
                    {words(item.severity ?? 'unclassified')}
                  </span>
                </span>
                <span>
                  <span class="status-label">
                    <span aria-hidden="true" />
                    {words(item.status)}
                  </span>
                </span>
                <time dateTime={item.updatedAt}>{formatDateTime(item.updatedAt)} UTC</time>
                <span class="row-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            ))
          ) : (
            <div class="empty-state">
              <span class="empty-icon" aria-hidden="true">
                ○
              </span>
              <h3>No incidents found</h3>
              <p>
                {filters.status || filters.severity || filters.kind
                  ? 'Try clearing or changing the current filters.'
                  : 'New security alerts will appear here after they are received.'}
              </p>
            </div>
          )}
        </div>
        {nextPageHref ? (
          <div class="pagination">
            <a class="button button-secondary" href={nextPageHref}>
              Next page <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : null}
      </section>
    </section>
  );
};

export const IncidentDetail: FC<
  Readonly<{
    detail: DashboardIncidentDetail;
    csrfToken: string;
    canDecide: boolean;
    canReview: boolean;
  }>
> = ({ detail, csrfToken, canDecide, canReview }) => {
  const decisionAvailable = Boolean(
    canDecide &&
    detail.plan &&
    detail.approval?.decision === null &&
    detail.incident.status === 'awaiting_approval' &&
    Date.parse(detail.plan.expiresAt) > Date.now(),
  );
  const groups = evidenceGroups(detail.evidence);
  const actions = detail.triage?.actions ?? [];
  const manualReviewDecision = detail.manualReview?.decision?.decision;
  const manualReviewAvailable = Boolean(
    canReview &&
    detail.manualReview &&
    (!manualReviewDecision || manualReviewDecision === 'accepted') &&
    detail.incident.status === 'investigating' &&
    detail.incident.workflowRunId,
  );
  const completingManualReview = manualReviewDecision === 'accepted';

  return (
    <section
      class="incident-detail"
      aria-live="polite"
      data-incident-id={detail.incident.incidentId}
      data-timeline-cursor={detail.timelineCursor}
      data-can-decide={String(canDecide)}
      data-can-review={String(canReview)}
      data-csrf-token={csrfToken}
    >
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/dashboard">All incidents</a>
        <span aria-hidden="true">/</span>
        <span>Review</span>
      </nav>
      <header class="incident-hero">
        <div>
          <h1>{incidentKindLabel(detail.incident.kind)}</h1>
          <p class="hero-meta">
            Subject <code>{shortRef(detail.incident.subjectRef)}</code> · Updated{' '}
            {formatDateTime(detail.incident.updatedAt)} UTC
          </p>
        </div>
        <div class="hero-status">
          <span class="status-badges" data-incident-summary>
            <span class={`badge severity-${detail.incident.severity ?? 'unclassified'}`}>
              {words(detail.incident.severity ?? 'unclassified')} severity
            </span>
            <span class="badge badge-neutral">{words(detail.incident.status)}</span>
          </span>
          <span class="live-indicator" data-live-status role="status">
            <span aria-hidden="true" /> Connecting
          </span>
        </div>
      </header>

      <div class="decision-layout">
        <div class="content-stack" data-triage-projection>
          {detail.triage ? (
            <>
              <section class="card summary-card" aria-labelledby="summary-heading">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Assessment</p>
                    <h2 id="summary-heading">What happened</h2>
                  </div>
                  <span class="runbook-chip" data-runbook>
                    {detail.triage.runbook}
                  </span>
                </div>
                <p class="lead" data-triage-summary>
                  {detail.triage.summary}
                </p>
                {detail.triage.facts.length ? (
                  <div class="finding-list" aria-label="Confirmed findings">
                    {detail.triage.facts.map((fact: string) => (
                      <p class="finding finding-confirmed">
                        <span aria-hidden="true">✓</span>
                        {fact}
                      </p>
                    ))}
                  </div>
                ) : null}
                {detail.triage.hypotheses.length ? (
                  <details class="hypotheses">
                    <summary>
                      {detail.triage.hypotheses.length} item
                      {detail.triage.hypotheses.length === 1 ? '' : 's'} still need confirmation
                    </summary>
                    {detail.triage.hypotheses.map((hypothesis: string) => (
                      <p class="finding finding-open">
                        <span aria-hidden="true">?</span>
                        {hypothesis}
                      </p>
                    ))}
                  </details>
                ) : null}
              </section>

              <section class="card" aria-labelledby="plan-heading">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Recommended response</p>
                    <h2 id="plan-heading">Containment actions</h2>
                  </div>
                  <span class="count-chip">{actions.length} proposed</span>
                </div>
                <div class="action-list">
                  {actions.map((action, index) => (
                    <article class="action-card">
                      <div class="action-number" aria-hidden="true">
                        {index + 1}
                      </div>
                      <div class="action-content">
                        <h3>{actionLabel(action.type)}</h3>
                        <p class="action-impact">{action.impact}</p>
                        <p class="target-line">
                          Target <code>{shortRef(action.targetRef)}</code>
                        </p>
                        <details class="technical-details">
                          <summary>Safety and verification details</summary>
                          <dl>
                            <div>
                              <dt>Preconditions</dt>
                              <dd>{action.preconditions.join('; ')}</dd>
                            </div>
                            <div>
                              <dt>Rollback</dt>
                              <dd>{action.rollback}</dd>
                            </div>
                            <div>
                              <dt>Verify</dt>
                              <dd>{action.verification}</dd>
                            </div>
                            <div>
                              <dt>Action ID</dt>
                              <dd>
                                <code>{action.actionId}</code>
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
                {detail.plan ? (
                  <details class="technical-details plan-binding" data-plan-binding>
                    <summary>Plan integrity details</summary>
                    <dl>
                      <div>
                        <dt>Fingerprint</dt>
                        <dd>
                          <code>
                            v{detail.plan.planHashVersion} · {detail.plan.planHash}
                          </code>
                        </dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatDateTime(detail.plan.expiresAt)} UTC</dd>
                      </div>
                    </dl>
                  </details>
                ) : null}
              </section>
            </>
          ) : detail.manualReview ? (
            <section class="card review-card" aria-labelledby="review-heading">
              <div class="section-heading">
                <div>
                  <h2 id="review-heading">Human assessment required</h2>
                </div>
                <span class="badge status-pending">Manual review</span>
              </div>
              <p class="lead">
                The workflow could not produce an evidence-backed containment recommendation. Review the available
                signals before deciding how this incident should be handled.
              </p>
              <ul class="review-reasons">
                {detail.manualReview.reasonCodes.map(reason => (
                  <li>{REVIEW_REASON_LABELS[reason] ?? words(reason)}</li>
                ))}
              </ul>
            </section>
          ) : (
            <section class="card">
              <h2 id="plan-heading">Assessment in progress</h2>
              <p class="muted">The workflow is still gathering and correlating evidence.</p>
            </section>
          )}
        </div>

        <aside class="decision-panel" aria-labelledby="decision-panel-heading" data-decision-panel>
          <p class="eyebrow">Action required</p>
          <h2 id="decision-panel-heading">
            {decisionAvailable
              ? `Review ${actions.length} containment action${actions.length === 1 ? '' : 's'}`
              : manualReviewAvailable
                ? completingManualReview
                  ? 'Complete manual review'
                  : 'Review the incident'
                : detail.manualReview?.decision
                  ? 'Manual review recorded'
                  : 'Decision status'}
          </h2>
          <p>
            {decisionAvailable
              ? 'Confirm that the proposed actions are safe and appropriately scoped before execution.'
              : manualReviewAvailable
                ? completingManualReview
                  ? "Record the analyst's resolution and close the incident. No containment action will run."
                  : 'Accept the incident for manual handling or dismiss it as a false positive. No containment action will run.'
                : detail.manualReview?.decision
                  ? detail.manualReview.decision.decision === 'accepted'
                    ? 'This incident was accepted for manual investigation.'
                    : detail.manualReview.decision.decision === 'resolved'
                      ? 'The manual investigation was completed and the incident was closed.'
                      : 'This incident was dismissed and closed without containment.'
                  : detail.approval?.decision
                    ? `This plan was ${detail.approval.decision}.`
                    : 'There is no active decision available for this incident.'}
          </p>
          {decisionAvailable ? (
            <>
              <p class="plan-expiry">Decision window closes {formatDateTime(detail.plan!.expiresAt)} UTC</p>
              <button class="button button-primary button-block" type="button" data-open-decision>
                Review proposed actions
              </button>
            </>
          ) : null}
          {manualReviewAvailable ? (
            <button class="button button-primary button-block" type="button" data-open-manual-review>
              {completingManualReview ? 'Finish manual review' : 'Review incident'}
            </button>
          ) : null}
          <p class="decision-note">Containment never runs without an explicit SOC manager decision.</p>
        </aside>
      </div>

      {detail.deviceTrust ? (
        <section class="card" aria-labelledby="device-trust-heading">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Device trust</p>
              <h2 id="device-trust-heading">Signed device identity</h2>
            </div>
            <span class={`badge ${detail.deviceTrust.currentlyAuthorized ? 'status-completed' : 'status-pending'}`}>
              {detail.deviceTrust.currentlyAuthorized ? 'Authorized' : 'Unknown device'}
            </span>
          </div>
          <p>
            Ed25519 signature: {detail.deviceTrust.signatureValid ? 'valid' : 'invalid'} · authorization at incident
            time: {detail.deviceTrust.authorizedAtIncident ? 'yes' : 'no'}
          </p>
          <p class="target-line">
            Device <code>{shortRef(detail.deviceTrust.deviceId)}</code>
          </p>
          {canDecide && detail.deviceTrust.signatureValid ? (
            <form class="decision-form" data-device-authorization-form>
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input
                type="hidden"
                name="action"
                value={detail.deviceTrust.currentlyAuthorized ? 'revoke' : 'authorize'}
              />
              <label class="field">
                Audit reason
                <textarea
                  name="reason"
                  maxLength={2000}
                  required
                  placeholder={
                    detail.deviceTrust.currentlyAuthorized
                      ? 'Why should this device lose access?'
                      : 'Why is this device trusted for this user?'
                  }
                />
              </label>
              <p class="form-error" data-device-authorization-error role="alert" />
              <button class="button button-secondary" type="submit">
                {detail.deviceTrust.currentlyAuthorized ? 'Revoke device' : 'Authorize device'}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <div data-runbook-projection>
        {detail.runbook ? (
          <details class="card runbook-card" data-runbook-viewer>
            <summary>
              <span>
                <span class="eyebrow">Response policy</span>
                <strong>
                  {detail.runbook.runbookId} · v{detail.runbook.version}
                </strong>
              </span>
              <span class="button button-secondary">View runbook</span>
            </summary>
            <div class="runbook-header">
              <div>
                <h2>Runbook used for this incident</h2>
                <p>
                  This is the immutable version consulted by the workflow. The highlighted sections were returned by
                  semantic retrieval.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>{words(detail.runbook.owner)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    <code>{detail.runbook.sourcePath}</code>
                  </dd>
                </div>
              </dl>
            </div>
            <div class="runbook-sections">
              {detail.runbook.sections.map(section => (
                <details class={section.selected ? 'is-relevant' : ''}>
                  <summary>
                    <span>{section.title}</span>
                    {section.selected ? <span class="count-chip">Used in retrieval</span> : null}
                  </summary>
                  <pre>{section.content}</pre>
                </details>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <section class="card" aria-labelledby="evidence-heading" data-evidence-projection>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Supporting signals</p>
            <h2 id="evidence-heading">Evidence coverage</h2>
          </div>
          <span class="count-chip">{detail.evidence.length} signals</span>
        </div>
        <div class="evidence-grid">
          {groups.map(group => (
            <article class={`evidence-card ${group.available ? 'is-available' : 'is-missing'}`}>
              <div class="evidence-icon" aria-hidden="true">
                {group.available ? '✓' : '!'}
              </div>
              <div>
                <h3>{words(group.source)}</h3>
                <p>
                  {group.available} of {group.count} signals available
                </p>
                <small>
                  {[...group.providers].map(words).join(', ')} · {Math.round((group.confidence / group.count) * 100)}%
                  confidence
                </small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section class="card" aria-labelledby="approval-heading" data-operational-projection>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Current state</p>
            <h2 id="approval-heading">Decision and execution</h2>
          </div>
        </div>
        <div class="status-grid">
          <div>
            <span>Decision</span>
            <strong data-approval-status>{words(detail.operationalState.decision)}</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong data-outcome-status>{words(detail.operationalState.execution)}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>
              {detail.actions.length ? `${detail.outcome.completedCount} / ${detail.actions.length}` : '—'}
            </strong>
          </div>
          <div>
            <span>Failed</span>
            <strong>{detail.actions.length ? detail.outcome.failedCount : '—'}</strong>
          </div>
        </div>
        {detail.approval?.reason ? <p class="decision-reason">Reason: {detail.approval.reason}</p> : null}
        <ul class="execution-list" data-actions>
          {detail.actions.map(action => (
            <li>
              <span>{actionLabel(action.type)}</span>
              <span class={`badge status-${action.status}`}>{words(action.status)}</span>
            </li>
          ))}
        </ul>
      </section>

      <details class="card activity-card">
        <summary>
          <span>
            <span class="eyebrow">Audit trail</span>
            <strong id="timeline-heading">Activity history</strong>
          </span>
          <span class="count-chip">{detail.timeline.length} events</span>
        </summary>
        <div class="timeline" data-timeline>
          {detail.timeline.map(event => (
            <article data-timeline-event={String(event.sequence)}>
              <span class="timeline-dot" aria-hidden="true" />
              <div>
                <strong>{eventLabel(event.type)}</strong>
                <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)} UTC</time>
                {Object.keys(event.payloadRedacted).length ? (
                  <details class="event-details">
                    <summary>Event details</summary>
                    <dl>
                      {Object.entries(event.payloadRedacted).map(([key, value]) => (
                        <div>
                          <dt>{words(key)}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </details>
      <div data-decision-host>
        {decisionAvailable && detail.plan ? (
          <dialog id="decision-dialog" aria-labelledby="decision-heading" aria-describedby="decision-help">
            <div class="dialog-header">
              <p class="eyebrow">Human approval gate</p>
              <h2 id="decision-heading">Review containment decision</h2>
              <p>Approve only if every action is appropriate for this incident and target.</p>
            </div>
            <form
              method="dialog"
              class="decision-form"
              data-decision-form
              data-incident-id={detail.incident.incidentId}
              data-plan-binding={`${detail.plan.planId}:${detail.plan.planHashVersion}:${detail.plan.planHash}:${detail.plan.expiresAt}`}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="planId" value={detail.plan.planId} />
              <input type="hidden" name="planHashVersion" value={String(detail.plan.planHashVersion)} />
              <input type="hidden" name="planHash" value={detail.plan.planHash} />
              <input type="hidden" name="planExpiresAt" value={detail.plan.expiresAt} />
              <label class="field">
                Decision
                <select name="decision">
                  <option value="approved">Approve proposed actions</option>
                  <option value="rejected">Reject proposed actions</option>
                </select>
              </label>
              <label class="field">
                Decision notes
                <textarea
                  name="reason"
                  maxLength={2000}
                  aria-describedby="reason-help"
                  placeholder="Required when rejecting; optional when approving."
                />
              </label>
              <p id="decision-help" class="dialog-help">
                Your decision is recorded in the incident audit trail. Approved actions execute only within the verified
                scope above.
              </p>
              <p class="form-error" data-decision-error role="alert" aria-live="assertive" />
              <div class="dialog-actions">
                <button class="button button-quiet" type="button" data-close-dialog>
                  Cancel
                </button>
                <button class="button button-primary" type="submit">
                  Confirm decision
                </button>
              </div>
            </form>
          </dialog>
        ) : manualReviewAvailable && detail.incident.workflowRunId ? (
          <dialog
            id="manual-review-dialog"
            aria-labelledby="manual-review-heading"
            aria-describedby="manual-review-help"
          >
            <div class="dialog-header">
              <p class="eyebrow">Human triage</p>
              <h2 id="manual-review-heading">
                {completingManualReview ? 'Complete manual review' : 'Record manual review'}
              </h2>
              <p>
                {completingManualReview
                  ? "Closing records the analyst's resolution in the audit trail. It does not execute containment actions."
                  : 'This decision handles the incident record only. It does not approve or execute containment actions.'}
              </p>
            </div>
            <form
              method="dialog"
              class="decision-form"
              data-manual-review-form
              data-incident-id={detail.incident.incidentId}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="workflowRunId" value={detail.incident.workflowRunId} />
              <label class="field">
                Decision
                <select name="decision">
                  {completingManualReview ? (
                    <option value="resolved">Mark as resolved and close</option>
                  ) : (
                    <>
                      <option value="accepted">Accept for manual handling</option>
                      <option value="dismissed">Dismiss as false positive</option>
                    </>
                  )}
                </select>
              </label>
              <label class="field">
                Review notes
                <textarea
                  name="reason"
                  maxLength={2000}
                  aria-describedby="manual-review-help"
                  placeholder={
                    completingManualReview
                      ? 'Required: summarize how the incident was resolved.'
                      : 'Required when dismissing; recommended for the audit trail.'
                  }
                />
              </label>
              <p id="manual-review-help" class="dialog-help">
                {completingManualReview
                  ? 'Resolving closes the incident and preserves these notes in the audit trail.'
                  : 'Accepting keeps the incident open for analyst investigation. Dismissing closes it without containment.'}
              </p>
              <p class="form-error" data-decision-error role="alert" aria-live="assertive" />
              <div class="dialog-actions">
                <button class="button button-quiet" type="button" data-close-dialog>
                  Cancel
                </button>
                <button class="button button-primary" type="submit">
                  {completingManualReview ? 'Resolve and close' : 'Record review'}
                </button>
              </div>
            </form>
          </dialog>
        ) : null}
      </div>
    </section>
  );
};

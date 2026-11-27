import { RuntimeState } from './runtime-state';
import { createRoot } from 'react-dom/client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, login, logout, readSession, type Session } from './api';
import {
  AgentsView,
  ApprovalsView,
  EvaluationsView,
  FindingsView,
  OverviewView,
  VulnerabilitiesView,
} from './intelligence';
import { PoliciesView, ScansView, TargetsView } from './operations';
import { Loading, Notice, Section, Status, Time, errorCode, useData } from './ui';

const views = [
  'overview',
  'scans',
  'targets',
  'agents',
  'findings',
  'vulnerabilities',
  'policies',
  'approvals',
  'evaluations',
  'settings',
] as const;
type View = (typeof views)[number];
const label = (view: string) => view[0]?.toUpperCase() + view.slice(1);
const navSymbols: Record<View, ReactNode> = {
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  scans: (
    <>
      <circle cx="11" cy="11" r="7" />
      <circle cx="11" cy="11" r="2" />
      <path d="m16 16 4 4" />
    </>
  ),
  targets: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </>
  ),
  agents: (
    <>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="m11 7-5 9m7-9 5 9M7 18h10" />
    </>
  ),
  findings: (
    <>
      <path d="M6 3h9l3 3v15H6zM15 3v4h3M9 11h6M9 15h4" />
      <circle cx="16" cy="16" r="3" />
    </>
  ),
  vulnerabilities: (
    <>
      <path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5zM13 6l-3 6h3l-2 6" />
    </>
  ),
  policies: (
    <>
      <path d="M6 3h9l3 3v15H6zM15 3v4h3M9 11h6M9 15h6" />
    </>
  ),
  approvals: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  evaluations: (
    <>
      <path d="M4 20h16M6 16v-5h3v5m3 0V5h3v11m3 0v-8h3v8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h3m4 0h9M4 12h10m4 0h2M4 17h4m4 0h8" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
};
function NavIcon({ view }: { view: View }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {navSymbols[view]}
    </svg>
  );
}
/** Resolve the initial console view from the URL hash, falling back to overview. */
const initialView = (): View => {
  const hash = window.location.hash.slice(1);
  return views.find(view => view === hash) ?? 'overview';
};

/** Submit the local bootstrap credential and display typed sign-in failures. */
function Login({ onLogin, initialError = '' }: { onLogin: (session: Session) => void; initialError?: string }) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  /** Submit the bootstrap credential and expose typed sign-in failure state. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const secret = String(new FormData(form).get('secret') ?? '');
    form.reset();
    setBusy(true);
    setError('');
    try {
      onLogin(await login(secret));
    } catch (reason) {
      const code = errorCode(reason);
      setError(code === 'LOCAL_SESSION_REQUIRED' ? 'INCORRECT_BOOTSTRAP_SECRET' : code);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <span className="eyebrow">Operator sign in</span>
        <h1>Security Scanner</h1>
        <p>Sign in to view the scanner's local operational state.</p>
        <form onSubmit={submit} autoComplete="off">
          <label>
            Bootstrap secret
            <input name="secret" type="password" minLength={32} maxLength={256} required autoComplete="off" autoFocus />
          </label>
          <Notice code={error} />
          <button className="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

/** Render persisted runtime and advisory settings with their supported operator controls. */
export function SettingsView() {
  const settings = useData<{
    discovery: { driver: string; requested: boolean };
    investigation: { requested: boolean; modelConfigured: boolean };
    sandbox: { driver: string; platform: string; memoryMiB: number; pids: number };
    storage: { driver: string };
    queue: { driver: string };
    limits: { commandTimeoutMs: number; outputBytes: number };
    session: { ttlSeconds: number };
  }>('/api/settings');
  const runtime = useData<{
    status: string;
    scanningEnabled: boolean;
    discoveryRequested: boolean;
    nativeExecutionEnabled: boolean;
  }>('/api/runtime');
  const reload = () => {
    settings.reload();
    runtime.reload();
  };
  return (
    <>
      <div className="form-actions">
        <button type="button" onClick={reload}>
          Refresh settings
        </button>
      </div>
      <Notice code={settings.error || runtime.error} stale={settings.stale || runtime.stale} onRetry={reload} />
      {settings.loading || runtime.loading ? (
        <Loading />
      ) : settings.data && runtime.data ? (
        <>
          {settings.stale && (
            <p className="hint" role="status">
              Settings data is stale; configuration reflects the last successful read.
            </p>
          )}
          {runtime.stale && (
            <p className="hint" role="status">
              Runtime data is stale; availability reflects the last successful read.
            </p>
          )}
          <RuntimeState />
          <div className="settings-grid">
            <Section title="Execution">
              <div className="settings-list">
                <div>
                  <span>Discovery driver</span>
                  <strong>{settings.data?.discovery.driver}</strong>
                </div>
                <div>
                  <span>Discovery availability</span>
                  <Status value={runtime.data?.scanningEnabled ? 'Available' : 'Unavailable'} />
                </div>
                <div>
                  <span>Investigation</span>
                  <Status
                    value={
                      settings.data?.investigation.requested && settings.data.investigation.modelConfigured
                        ? 'Configured'
                        : 'Unavailable'
                    }
                  />
                </div>
                <div>
                  <span>Native execution</span>
                  <Status value={runtime.data?.nativeExecutionEnabled ? 'Available' : 'Disabled'} />
                </div>
              </div>
            </Section>
            <Section title="Local runtime">
              <div className="settings-list">
                <div>
                  <span>Sandbox</span>
                  <strong>
                    {settings.data?.sandbox.driver} · {settings.data?.sandbox.platform}
                  </strong>
                </div>
                <div>
                  <span>Memory / PIDs</span>
                  <strong>
                    {settings.data?.sandbox.memoryMiB} MiB / {settings.data?.sandbox.pids}
                  </strong>
                </div>
                <div>
                  <span>Storage / queue</span>
                  <strong>
                    {settings.data?.storage.driver} / {settings.data?.queue.driver}
                  </strong>
                </div>
                <div>
                  <span>Command timeout</span>
                  <strong>{settings.data?.limits.commandTimeoutMs} ms</strong>
                </div>
                <div>
                  <span>Output limit</span>
                  <strong>{settings.data?.limits.outputBytes} bytes</strong>
                </div>
                <div>
                  <span>Session lifetime</span>
                  <strong>{settings.data?.session.ttlSeconds} seconds</strong>
                </div>
              </div>
            </Section>
          </div>
          <Section title="Configuration">
            <p className="hint">
              Runtime settings are validated at startup. Change local environment settings and restart the control plane
              to apply them. Secrets, database paths and credential values are excluded from this view.
            </p>
          </Section>
        </>
      ) : null}
    </>
  );
}

/** Render the selected console view with shared navigation callbacks. */
function CurrentView({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  if (view === 'overview')
    return (
      <OverviewView
        navigate={name => {
          const next = views.find(item => item === name);
          if (next) navigate(next);
        }}
      />
    );
  if (view === 'scans') return <ScansView />;
  if (view === 'targets') return <TargetsView />;
  if (view === 'agents') return <AgentsView />;
  if (view === 'findings') return <FindingsView />;
  if (view === 'vulnerabilities') return <VulnerabilitiesView />;
  if (view === 'policies') return <PoliciesView />;
  if (view === 'approvals') return <ApprovalsView />;
  if (view === 'evaluations') return <EvaluationsView />;
  return <SettingsView />;
}

const priorSessionKey = 'scanner-prior-session';

/** Manage authenticated console navigation and explicit sign-out failure state. */
function Console({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [view, setView] = useState<View>(initialView);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const handler = () => setView(initialView());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  function navigate(next: View) {
    window.location.hash = next;
    setView(next);
    document.querySelector('main h1')?.scrollIntoView({ block: 'start' });
  }
  /** Revoke the current local session and keep sign-out failure visible for retry. */
  async function signOut() {
    setSignOutError('');
    setSigningOut(true);
    try {
      await logout();
      onLogout();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 403 && error.code === 'LOCAL_SESSION_REQUIRED')) {
        setSignOutError('SIGN_OUT_FAILED');
      }
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            S
          </div>
          <div>
            <strong>Security Scanner</strong>
          </div>
        </div>
        <nav aria-label="Primary">
          <span className="nav-group">Workspace</span>
          {views.slice(0, 4).map(item => (
            <button
              key={item}
              type="button"
              aria-label={label(item)}
              className={view === item ? 'active' : ''}
              aria-current={view === item ? 'page' : undefined}
              onClick={() => navigate(item)}
            >
              <span className="nav-glyph" aria-hidden="true">
                <NavIcon view={item} />
              </span>
              <span>{label(item)}</span>
            </button>
          ))}
          <span className="nav-group">Intelligence</span>
          {views.slice(4, 8).map(item => (
            <button
              key={item}
              type="button"
              aria-label={label(item)}
              className={view === item ? 'active' : ''}
              aria-current={view === item ? 'page' : undefined}
              onClick={() => navigate(item)}
            >
              <span className="nav-glyph" aria-hidden="true">
                <NavIcon view={item} />
              </span>
              <span>{label(item)}</span>
            </button>
          ))}
          <span className="nav-group">System</span>
          {views.slice(8).map(item => (
            <button
              key={item}
              type="button"
              aria-label={label(item)}
              className={view === item ? 'active' : ''}
              aria-current={view === item ? 'page' : undefined}
              onClick={() => navigate(item)}
            >
              <span className="nav-glyph" aria-hidden="true">
                <NavIcon view={item} />
              </span>
              <span>{label(item)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>{session.operator}</span>
          <button type="button" aria-label="Sign out" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <strong className="mobile-product">Security Scanner</strong>
          <span>
            Session expires <Time value={session.expiresAt} />
          </span>
        </header>
        <main id="main">
          <Notice code={signOutError} />
          <div className="page-heading">
            <div>
              <h1>{label(view)}</h1>
            </div>
            {view === 'overview' && (
              <button className="primary" onClick={() => navigate('targets')}>
                New scan
              </button>
            )}
          </div>
          <CurrentView view={view} navigate={navigate} />
        </main>
      </div>
    </div>
  );
}

/** Recover the local session and switch between authenticated console and sign-in views. */
function App() {
  const [session, setSession] = useState<Session>();
  const [loginReason, setLoginReason] = useState('');
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    readSession()
      .then(
        value => {
          if (active) {
            sessionStorage.setItem(priorSessionKey, '1');
            setSession(value);
          }
        },
        error => {
          if (!active) return;
          if (error instanceof ApiError && error.status === 403 && error.code === 'LOCAL_SESSION_REQUIRED') {
            if (sessionStorage.getItem(priorSessionKey)) setLoginReason('SESSION_ENDED');
          } else {
            setLoginReason(errorCode(error));
          }
        },
      )
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    /** Clear the expired or revoked session and preserve the reason shown on the sign-in view. */
    const ended = () => {
      setLoginReason(Date.now() >= Date.parse(session.expiresAt) ? 'SESSION_EXPIRED' : 'SESSION_ENDED');
      setSession(undefined);
    };
    window.addEventListener('scanner-session-expired', ended);
    return () => window.removeEventListener('scanner-session-expired', ended);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const delay = Math.max(0, Date.parse(session.expiresAt) - Date.now());
    const timer = window.setTimeout(() => {
      setLoginReason('SESSION_EXPIRED');
      setSession(undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session]);
  if (checking)
    return (
      <div className="boot">
        <Loading />
      </div>
    );
  return session ? (
    <Console
      session={session}
      onLogout={() => {
        setLoginReason('');
        sessionStorage.removeItem(priorSessionKey);
        setSession(undefined);
      }}
    />
  ) : (
    <Login
      initialError={loginReason}
      onLogin={value => {
        setLoginReason('');
        sessionStorage.setItem(priorSessionKey, '1');
        setSession(value);
      }}
    />
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

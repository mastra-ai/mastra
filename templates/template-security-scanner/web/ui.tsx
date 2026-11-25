import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, get } from './api';

/** Load revision-independent API data while discarding obsolete responses and marking retained failures stale. */
export function useData<T>(path: string) {
  const [state, setState] = useState<{ path: string; data?: T; error: string; loading: boolean }>({
    path,
    error: '',
    loading: true,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ path, error: '', loading: false });
      return () => {
        active = false;
      };
    }
    setState(previous => ({
      path,
      data: previous.path === path ? previous.data : undefined,
      error: '',
      loading: true,
    }));
    get<T>(path).then(
      value => {
        if (!active) return;
        setState({ path, data: value, error: '', loading: false });
      },
      reason => {
        if (!active) return;
        setState(previous => ({
          path,
          data: previous.path === path ? previous.data : undefined,
          error: errorCode(reason),
          loading: false,
        }));
      },
    );
    return () => {
      active = false;
    };
  }, [path, version]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : '',
    loading: state.path !== path || state.loading,
    stale: state.path === path && !!state.error && state.data !== undefined,
    reload: () => {
      setVersion(value => value + 1);
    },
  };
}

/** Expose a typed API error code or a bounded generic request failure. */
export function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : 'REQUEST_FAILED';
}

/** Display a readable operational failure with optional retry and stale-data context. */
export function Notice({ code, onRetry, stale = false }: { code: string; onRetry?: () => void; stale?: boolean }) {
  if (!code) return null;
  const message =
    code === 'LOCAL_SESSION_REQUIRED'
      ? 'Sign in to continue.'
      : code === 'INCORRECT_BOOTSTRAP_SECRET'
        ? 'Incorrect bootstrap secret. Try again.'
        : code === 'SESSION_EXPIRED'
          ? 'Session expired. Sign in again.'
          : code === 'SESSION_ENDED'
            ? 'Your session is no longer active. Sign in again.'
            : code === 'SIGN_OUT_FAILED'
              ? 'Could not confirm sign out. Check the connection and try again.'
              : code === 'SCAN_BINDING_CHANGED'
                ? 'This scan uses an older target, policy, or profile revision. Check identities and run a new scan before investigating.'
                : code === 'REVISION_CONFLICT' || code === 'APPROVAL_CONFLICT'
                  ? 'This record changed. Reload it before trying again.'
                  : code === 'CONNECTION_UNAVAILABLE'
                    ? 'The local control plane is unavailable.'
                    : `Request failed: ${code.replaceAll('_', ' ').toLowerCase()}.`;
  return (
    <div className="notice" role="alert">
      <span>
        {message}
        {stale ? ' Last successful records are stale; current state is unavailable.' : ''}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Reload
        </button>
      )}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Render a status label using the recognized success, warning and failure tones. */
export function Status({ value }: { value: string }) {
  const tone = /^(COMPLETED|CONFIRMED|READY|approved|published|closed)$/.test(value)
    ? 'good'
    : /^(FAILED|AUTH_REQUIRED|BLOCKED|DEBT|denied|withdrawn)$/.test(value)
      ? 'bad'
      : /^(QUEUED|RUNNING|pending|new|AWAITING_APPROVAL|COMPLETED_WITH_ERRORS)$/.test(value)
        ? 'warn'
        : '';
  return <span className={`status ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

/** Format a valid persisted timestamp and show an empty marker for unavailable values. */
export function Time({ value }: { value?: string | null }) {
  if (!value) return <span className="muted">—</span>;
  const date = new Date(value);
  return (
    <time dateTime={value} title={date.toLocaleString()}>
      {date.toLocaleString()}
    </time>
  );
}

/** Render bounded previous and next controls from the current result page. */
export function Pager({
  offset,
  count,
  limit,
  onChange,
}: {
  offset: number;
  count: number;
  limit: number;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="pager">
      <span>{count ? `${offset + 1}–${offset + count}` : 'No records'}</span>
      <div>
        <button type="button" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button type="button" disabled={count < limit} onClick={() => onChange(offset + limit)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Render a modal form or record detail and restore focus when its owner closes it. */
export function Dialog({
  title,
  onClose,
  children,
  variant = 'form',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'form' | 'details';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      opener.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={event => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      aria-label={title}
      className={variant === 'details' ? 'detail-dialog' : undefined}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {variant === 'details' ? <div className="dialog-body">{children}</div> : children}
    </dialog>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status">
      Loading…
    </div>
  );
}

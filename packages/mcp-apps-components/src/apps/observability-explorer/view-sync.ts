import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useRef } from 'react';
import { readResult } from '../../shared/mcp-app';

/** The `_meta` key the built-in MCP server puts an explorer's view id under, when the model can steer it. */
export const VIEW_ID_META = 'mastra/viewId';
const SYNC_TOOL = 'sync_observability_view';
/** How often a view on screen checks for the model's changes. */
export const VIEW_POLL_MS = 1500;
/** The longest description of the screen the server takes. */
export const MAX_CONTEXT = 4000;

/** What the model asked the view to show: a tool's result (its tab and filters), and a trace open over it. */
export type SteeredView = { tool?: string; args?: Record<string, unknown>; traceId?: string; spanId?: string };
type Synced = { version: number; by?: 'model' | 'app'; state?: (SteeredView & { context?: string }) | null };

export function readViewId(result: { _meta?: Record<string, unknown> }): string | undefined {
  const id = result._meta?.[VIEW_ID_META];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

const shown = ({ tool, args, traceId, spanId }: SteeredView) => JSON.stringify({ tool, args, traceId, spanId });

/**
 * Whether a failed sync call says the view isn't the caller's to steer, which no retry changes. The server
 * sends a tool's error as its serialized `MastraError`; the built-in server's sits in its `cause` chain, with
 * the HTTP status under `details.status`.
 */
function isFinal(result: { content?: unknown[] }): boolean {
  return (result.content ?? []).some(part => {
    if ((part as { type?: unknown }).type !== 'text') return false;
    let error: unknown;
    try {
      error = JSON.parse(String((part as { text?: unknown }).text));
    } catch {
      return false;
    }
    for (let depth = 0; error && typeof error === 'object' && depth < 5; depth++) {
      const { details, cause } = error as { details?: { status?: unknown }; cause?: unknown };
      if (details?.status === 403 || details?.status === 404) return true;
      error = cause;
    }
    return false;
  });
}

/**
 * Keeps an explorer in step with its record on the server, by its view id. While the page is visible it polls
 * for changes and calls `onSteer` with each new state the model sets; `report` writes what the user has on
 * screen, against the version the view shows, so the server refuses it once the model has moved on.
 */
export function useViewSync(app: App, viewId: string | undefined, onSteer: (state: SteeredView) => void) {
  const version = useRef(0);
  // The model's last change the view applied, while the screen still shows it; a repeat of it is no change.
  const applied = useRef<string>(undefined);
  // What the screen said right after applying it: once it says something else, the user has moved on.
  const appliedContext = useRef<string | null>(undefined);
  const gone = useRef(false);
  // Reports go one at a time, each against the version the last one left, so two quick changes can't race.
  const pending = useRef<(SteeredView & { context: string }) | undefined>(undefined);
  const sending = useRef(false);
  // Bumped when the view id changes, so a report loop for the old view stops.
  const generation = useRef(0);
  const onSteerRef = useRef(onSteer);
  onSteerRef.current = onSteer;

  useEffect(() => {
    version.current = 0;
    applied.current = undefined;
    appliedContext.current = undefined;
    gone.current = false;
    pending.current = undefined;
    sending.current = false;
    generation.current++;
    if (!viewId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === 'visible' && !gone.current) {
        try {
          const result = await app.callServerTool({ name: SYNC_TOOL, arguments: { viewId, since: version.current } });
          if (result.isError) {
            // Anything else (a cache hiccup, a server restarting) may pass: try again next time.
            if (isFinal(result)) gone.current = true;
          } else {
            const synced = readResult(result) as Synced | undefined;
            // An older version means the record expired and started over.
            if (!stopped && synced && synced.version !== version.current) {
              version.current = synced.version;
              // The view's own reports come back as well; only a different list or trace is a change.
              if (synced.by === 'model' && synced.state && shown(synced.state) !== applied.current) {
                applied.current = shown(synced.state);
                appliedContext.current = null;
                onSteerRef.current(synced.state);
              }
            }
          }
        } catch {
          // The host or connection dropped the call; try again next time.
        }
      }
      if (!stopped && !gone.current) timer = setTimeout(poll, VIEW_POLL_MS);
    };
    timer = setTimeout(poll, VIEW_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [app, viewId]);

  return useCallback(
    async (state: SteeredView & { context: string }) => {
      if (!viewId || gone.current) return;
      pending.current = { ...state, context: state.context.slice(0, MAX_CONTEXT) };
      if (sending.current) return;
      sending.current = true;
      const ours = generation.current;
      try {
        while (pending.current && !gone.current && generation.current === ours) {
          const next = pending.current;
          pending.current = undefined;
          const steered = applied.current;
          if (appliedContext.current === null) appliedContext.current = next.context;
          // The user moved off what the model set, so the model setting it again has to apply again.
          const movesOff = appliedContext.current !== undefined && next.context !== appliedContext.current;
          try {
            const result = await app.callServerTool({
              name: SYNC_TOOL,
              arguments: { viewId, state: next, base: version.current },
            });
            if (generation.current !== ours) return;
            if (result.isError && isFinal(result)) gone.current = true;
            const written = result.isError ? undefined : (readResult(result) as Synced | undefined);
            if (written && written.version > version.current) version.current = written.version;
            // Only once the server took it, and unless the model set something new meanwhile.
            if (written && movesOff && applied.current === steered) applied.current = undefined;
          } catch {
            // Best effort, like model context: the next change reports again.
          }
        }
      } finally {
        if (generation.current === ours) sending.current = false;
      }
    },
    [app, viewId],
  );
}

import type { App } from '@modelcontextprotocol/ext-apps';
import { useCallback, useEffect, useRef } from 'react';
import { readResult } from '../../shared/mcp-app';

/** The `_meta` key the built-in MCP server puts an explorer's view id under, when the model can steer it. */
export const VIEW_ID_META = 'mastra/viewId';
const SYNC_TOOL = 'sync_observability_view';
/** How often a view on screen checks for the model's changes. */
export const VIEW_POLL_MS = 1500;

/** What the model asked the view to show: a tool's result (its tab and filters), and a trace open over it. */
export type SteeredView = { tool?: string; args?: Record<string, unknown>; traceId?: string; spanId?: string };
type Synced = { version: number; by?: 'model' | 'app'; state?: (SteeredView & { context?: string }) | null };

export function readViewId(result: { _meta?: Record<string, unknown> }): string | undefined {
  const id = result._meta?.[VIEW_ID_META];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

const shown = ({ tool, args, traceId, spanId }: SteeredView) => JSON.stringify({ tool, args, traceId, spanId });

/**
 * Keeps an explorer in step with its record on the server, by its view id. While the page is visible it polls
 * for changes and calls `onSteer` with each new state the model sets; `report` writes what the user has on
 * screen, against the version the view shows, so the server refuses it once the model has moved on.
 */
export function useViewSync(app: App, viewId: string | undefined, onSteer: (state: SteeredView) => void) {
  const version = useRef(0);
  const applied = useRef<string>(undefined);
  const gone = useRef(false);
  const onSteerRef = useRef(onSteer);
  onSteerRef.current = onSteer;

  useEffect(() => {
    if (!viewId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const result = await app.callServerTool({ name: SYNC_TOOL, arguments: { viewId, since: version.current } });
          if (result.isError) {
            // Expired, or the server stopped offering steering: nothing more will change.
            gone.current = true;
          } else {
            const synced = readResult(result) as Synced | undefined;
            if (!stopped && synced && synced.version > version.current) {
              version.current = synced.version;
              // The view's own reports come back as well; only a different list or trace is a change.
              if (synced.by === 'model' && synced.state && shown(synced.state) !== applied.current) {
                applied.current = shown(synced.state);
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
      try {
        const result = await app.callServerTool({
          name: SYNC_TOOL,
          arguments: { viewId, state, base: version.current },
        });
        const written = result.isError ? undefined : (readResult(result) as Synced | undefined);
        if (written && written.version > version.current) {
          version.current = written.version;
          applied.current = shown(state);
        }
      } catch {
        // Best effort, like model context: the next change reports again.
      }
    },
    [app, viewId],
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { frameFillStyle, frameSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import type { App, McpUiDisplayMode } from '@modelcontextprotocol/ext-apps';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** The `_meta` key the built-in MCP server puts Studio's base URL under, when it knows it. */
export const STUDIO_URL_META = 'mastra/studioUrl';

export function readStudioUrl(result: { _meta?: Record<string, unknown> }): string | undefined {
  const url = result._meta?.[STUDIO_URL_META];
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url.replace(/\/+$/, '') : undefined;
}

/**
 * What one view on screen reports: a line for the model, and the matching Studio page. `studioPath: null` says
 * Studio has no page that shows the view, so no outer view's page stands in for it.
 */
type Part = { depth: number; context?: string; studioPath?: string | null };

type Host = {
  app: App;
  studioUrl?: string;
  depth: number;
  report: (id: string, part: Part | undefined) => void;
  studioPath?: string;
  displayMode?: McpUiDisplayMode;
  setDisplayMode: (mode: McpUiDisplayMode) => void;
};

const HostContext = createContext<Host | undefined>(undefined);

function useHost(): Host {
  const host = useContext(HostContext);
  if (!host) throw new Error('Wrap the app in <AppHost>.');
  return host;
}

/** How long the app waits for the view to settle before telling the host what's on screen. */
const CONTEXT_DELAY_MS = 400;

/**
 * Connects the app's views to the host. Each `<AppState>` adds a line about what the user is looking at, and
 * the lines, outermost first, go to the model through `updateModelContext`, so a follow-up question like "why
 * did this fail?" refers to what's on screen. The innermost view's `studioPath` is the "Open in Studio" target.
 */
export function AppHost({
  app,
  name,
  studioUrl,
  children,
}: {
  app: App;
  /** The app's name, as the user sees it. */
  name: string;
  studioUrl?: string;
  children: ReactNode;
}) {
  const [parts, setParts] = useState<ReadonlyMap<string, Part>>(new Map());
  const report = useCallback((id: string, part: Part | undefined) => {
    setParts(current => {
      const previous = current.get(id);
      if (part && previous && previous.context === part.context && previous.studioPath === part.studioPath) {
        return current;
      }
      if (!part && !previous) return current;
      const next = new Map(current);
      if (part) next.set(id, part);
      else next.delete(id);
      return next;
    });
  }, []);

  const ordered = [...parts.values()].sort((a, b) => a.depth - b.depth);
  const lines = ordered.flatMap(part => (part.context ? [part.context] : []));
  const context = lines.length > 0 ? [`The user has Mastra's ${name} open.`, ...lines].join('\n') : undefined;
  const studioPath = [...ordered].reverse().find(part => part.studioPath !== undefined)?.studioPath ?? undefined;

  const [displayMode, setDisplayMode] = useState(() => app.getHostContext()?.displayMode);
  useEffect(() => {
    const onChange = (context: { displayMode?: McpUiDisplayMode }) => {
      if (context.displayMode) setDisplayMode(context.displayMode);
    };
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);

  useEffect(() => {
    if (!context || !app.getHostCapabilities()?.updateModelContext) return;
    const timer = setTimeout(() => {
      // Best effort: a host that turns the update down still shows the app.
      app.updateModelContext({ content: [{ type: 'text', text: context }] }).catch(() => {});
    }, CONTEXT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [app, context]);

  const host = useMemo(
    () => ({ app, studioUrl, depth: 0, report, studioPath, displayMode, setDisplayMode }),
    [app, studioUrl, report, studioPath, displayMode],
  );
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

/** Reports a view while it's on screen. Views nested inside it report after it. */
export function AppState({
  context,
  studioPath,
  children,
}: {
  context?: string;
  studioPath?: string | null;
  children?: ReactNode;
}) {
  const host = useHost();
  const id = useId();
  const depth = host.depth + 1;
  const { report } = host;
  useEffect(() => report(id, { depth, context, studioPath }), [report, id, depth, context, studioPath]);
  useEffect(() => () => report(id, undefined), [report, id]);
  const nested = useMemo(() => ({ ...host, depth }), [host, depth]);
  return <HostContext.Provider value={nested}>{children}</HostContext.Provider>;
}

/** The host's display mode, which changes when the user or the app goes fullscreen. */
export function useDisplayMode(): McpUiDisplayMode | undefined {
  return useHost().displayMode;
}

/**
 * The card every app sits in: Studio's frame surface, so an app reads the same on any host's background. Inline
 * it has the frame's edge, rounding, and elevation, with a margin so the host doesn't clip its shadow; `fixed`
 * gives it a set height for apps that scroll inside. Fullscreen, it fills the screen with neither. It works
 * outside `<AppHost>` too, so loading and error states sit in the same card.
 */
export function AppFrame({ children, fixed = false }: { children: ReactNode; fixed?: boolean }) {
  const fullscreen = useContext(HostContext)?.displayMode === 'fullscreen';
  const shape = fullscreen
    ? `h-screen p-2 ${frameFillStyle}`
    : // Inset by Studio's frame inset so the tab pills sit concentric with the card's corners, and keep the
      // card off the iframe's edges so its outline and shadow aren't clipped.
      `m-2 rounded-studio-frame p-2 ${fixed ? 'h-[44rem]' : ''} ${frameSurfaceStyle}`;
  return (
    <div data-slot="mcp-app-frame" className={`flex flex-col overflow-hidden ${shape}`}>
      {children}
    </div>
  );
}

/** "Open in Studio" for what's on screen, and a fullscreen toggle, for whichever the host supports. */
export function AppToolbar() {
  const { app, studioUrl, studioPath, displayMode: mode, setDisplayMode } = useHost();
  const canFullscreen = app.getHostContext()?.availableDisplayModes?.includes('fullscreen') ?? false;
  const canOpenLinks = Boolean(app.getHostCapabilities()?.openLinks);
  const studioLink = studioUrl && studioPath && canOpenLinks ? `${studioUrl}${studioPath}` : undefined;
  if (!studioLink && !canFullscreen) return null;

  const fullscreen = mode === 'fullscreen';
  return (
    <div className="flex shrink-0 items-center gap-1">
      {studioLink && (
        <Button size="sm" variant="ghost" onClick={() => void app.openLink({ url: studioLink }).catch(() => {})}>
          Open in Studio
        </Button>
      )}
      {canFullscreen && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void app
              .requestDisplayMode({ mode: fullscreen ? 'inline' : 'fullscreen' })
              // A host may answer with the mode it switched to and send no context change.
              .then(result => setDisplayMode(result.mode))
              .catch(() => {})
          }
        >
          {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
      )}
    </div>
  );
}

/** Asks the model about something on screen, as a message from the user, when the host takes messages. */
export function AskButton({ label, prompt }: { label: string; prompt: string }) {
  const { app } = useHost();
  const [sending, setSending] = useState(false);
  if (!app.getHostCapabilities()?.message) return null;
  const ask = () => {
    setSending(true);
    app
      .sendMessage({ role: 'user', content: [{ type: 'text', text: prompt }] })
      .catch(() => {})
      .finally(() => setSending(false));
  };
  return (
    <Button size="sm" variant="default" disabled={sending} onClick={ask}>
      {label}
    </Button>
  );
}

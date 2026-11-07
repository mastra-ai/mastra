import {
  BUILT_IN_WIDGET_KINDS,
  StatelessWidget,
  WidgetError,
  planWidget,
  prepareWidget,
} from '@mastra/playground-ui/domains/dashboards';
import type { ReadyPreparedWidget, WidgetState } from '@mastra/playground-ui/domains/dashboards';
import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import type { App, McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { readOpened } from './opened';
import type { Opened } from './opened';
import { usePin } from './use-pin';
import { useToolResults } from './use-tool-results';

const REGISTRY = new Map(BUILT_IN_WIDGET_KINDS.map(kind => [kind.kind, kind]));

/** Follows the host's theme: playground-ui's tokens are dark unless `html.light` is set. */
function applyTheme(theme: McpUiTheme | undefined) {
  if (!theme) return;
  applyDocumentTheme(theme);
  document.documentElement.classList.toggle('light', theme === 'light');
}

/** Plans the widget's requests, sends them through the server's tool, and draws the answers. */
function Widget({
  app,
  opened,
  prepared,
}: {
  app: App;
  opened: Extract<Opened, { status: 'ready' }>;
  prepared: ReadyPreparedWidget;
}) {
  const { env } = opened;
  const [state, setState] = useState<WidgetState>({});
  const pin = usePin(app, opened.widget, opened.datePreset);
  const first = planWidget(prepared, env, state);
  const discovered = useToolResults(app, first.status === 'ready' ? first.discover : []);
  // Planned again with the discover answers so far; both lists go out in the same render.
  const plan = planWidget(prepared, env, state, discovered.results);
  const sent = useToolResults(app, plan.status === 'ready' ? plan.requests : []);
  return (
    <StatelessWidget
      prepared={prepared}
      env={env}
      state={state}
      onStateChange={setState}
      discovered={discovered.results}
      results={sent.results}
      onRetry={() => {
        discovered.retry();
        sent.retry();
      }}
      scope="project"
      pin={pin}
    />
  );
}

function OpenedWidget({ app, opened }: { app: App; opened: Extract<Opened, { status: 'ready' }> }) {
  const prepared = prepareWidget(opened.widget, REGISTRY, 'project');
  const heading = {
    id: opened.widget.id,
    title: typeof opened.widget.title === 'string' ? opened.widget.title : undefined,
  };
  if (prepared.ok === 'hidden') return <p role="alert">This widget isn't shown for a project.</p>;
  if (!prepared.ok) return <WidgetError widget={heading} message={prepared.message} />;
  return <Widget app={app} opened={opened} prepared={prepared} />;
}

/**
 * Draws the one dashboard widget the opening tool returned (`ui/notifications/tool-result`), over
 * the window its `datePreset` names. Every read goes through the server's app-only
 * `queryObservability` tool, so the server decides where the data comes from.
 */
export function ObservabilityWidget() {
  const [opened, setOpened] = useState<Opened>();
  // A failed read is shown with a retry button; the server's tool decides whether to retry itself.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const { app, error } = useApp({
    appInfo: { name: 'Mastra observability widget', version: '1.0.0' },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolresult = result => setOpened(readOpened(result.structuredContent, Date.now()));
      app.onhostcontextchanged = context => applyTheme(context.theme);
    },
  });
  useEffect(() => applyTheme(app?.getHostContext()?.theme), [app]);

  if (error) return <p role="alert">Couldn't connect to the host: {error.message}</p>;
  if (!app || !opened) return <p>Loading the widget…</p>;
  if (opened.status === 'error') return <p role="alert">{opened.message}</p>;

  return (
    <QueryClientProvider client={queryClient}>
      <OpenedWidget key={opened.widget.id + opened.env.window.end.getTime()} app={app} opened={opened} />
    </QueryClientProvider>
  );
}

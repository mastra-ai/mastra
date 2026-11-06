import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import {
  BUILT_IN_WIDGET_KINDS,
  DashboardGrid,
  DashboardGridCell,
  DashboardGridRow,
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
import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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

type ReadyOpened = Extract<Opened, { status: 'ready' }>;

/** Keeps a widget that throws while rendering to its own card, so the rest of the dashboard still draws. */
class WidgetBoundary extends Component<{ widget: DashboardWidget; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    return error ? <WidgetError widget={this.props.widget} message={error.message} /> : this.props.children;
  }
}

/** Plans the widget's requests, sends them through the server's tool, and draws the answers. */
function Widget({
  app,
  opened,
  widget,
  prepared,
}: {
  app: App;
  opened: ReadyOpened;
  widget: DashboardWidget;
  prepared: ReadyPreparedWidget;
}) {
  const { env } = opened;
  const [state, setState] = useState<WidgetState>({});
  const pin = usePin(app, widget, opened.datePreset, opened.dashboard.defaults?.filters);
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

/**
 * Lays the dashboard's rows out on Studio's 12-column grid. Each widget is checked and drawn on its
 * own: one that fails to parse, query or render shows its own error and the rest still draw. Rows
 * whose widgets are all hidden for a project leave no gap.
 */
function OpenedDashboard({ app, opened }: { app: App; opened: ReadyOpened }) {
  const rows = opened.dashboard.rows
    .map(row => row.widgets.map(widget => ({ widget, prepared: prepareWidget(widget, REGISTRY, 'project') })))
    .map(cells => cells.filter(cell => cell.prepared.ok !== 'hidden'))
    .filter(cells => cells.length > 0);
  if (rows.length === 0) return <p role="alert">None of this dashboard's widgets are shown for a project.</p>;

  return (
    <DashboardGrid>
      {rows.map(cells => (
        <DashboardGridRow key={cells[0]!.widget.id}>
          {cells.map(({ widget, prepared }) => (
            <DashboardGridCell key={widget.id} id={widget.id} span={widget.span}>
              <WidgetBoundary widget={widget}>
                {prepared.ok === true ? (
                  <Widget app={app} opened={opened} widget={widget} prepared={prepared} />
                ) : (
                  <WidgetError widget={widget} message={prepared.ok === false ? prepared.message : ''} />
                )}
              </WidgetBoundary>
            </DashboardGridCell>
          ))}
        </DashboardGridRow>
      ))}
    </DashboardGrid>
  );
}

/**
 * Draws the dashboard the opening tool returned (`ui/notifications/tool-result`), over the window its
 * `datePreset` names and under its `defaults.filters`. Every read goes through the server's app-only
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
  if (!app || !opened) return <p>Loading the dashboard…</p>;
  if (opened.status === 'error') return <p role="alert">{opened.message}</p>;

  return (
    <QueryClientProvider client={queryClient}>
      <OpenedDashboard key={opened.env.window.end.getTime()} app={app} opened={opened} />
    </QueryClientProvider>
  );
}

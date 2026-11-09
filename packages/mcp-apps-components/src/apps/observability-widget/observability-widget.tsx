import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
import type { DashboardScope, ReadyPreparedWidget, WidgetState } from '@mastra/playground-ui/domains/dashboards';
import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import type { App, McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InfoIcon, OctagonAlertIcon } from 'lucide-react';
import { Component, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readOpened, readView } from './opened';
import type { Opened } from './opened';
import { OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY } from './tool';
import type { ObservabilityWidgetView } from './tool';
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

/**
 * A whole-app state drawn straight on the host's frame: no surface or border of its own, and at
 * least the 100px the host gives the frame, so the content sits centred instead of leaving a gap.
 */
function AppState({ children, ...props }: { children: ReactNode; role?: 'alert' | 'status'; 'aria-label'?: string }) {
  return (
    <div {...props} className="flex min-h-25 items-center px-4 py-3">
      {children}
    </div>
  );
}

function AppMessage({ tone, title, children }: { tone: 'error' | 'info'; title: string; children: ReactNode }) {
  const Icon = tone === 'error' ? OctagonAlertIcon : InfoIcon;
  return (
    <AppState role="alert">
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 ${tone === 'error' ? 'text-destructive-indicator' : 'text-info-indicator'}`}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Txt variant="subheading">{title}</Txt>
          <Txt variant="body-sm" tone="muted" className="wrap-anywhere">
            {children}
          </Txt>
        </div>
      </div>
    </AppState>
  );
}

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
  scope,
}: {
  app: App;
  opened: ReadyOpened;
  widget: DashboardWidget;
  prepared: ReadyPreparedWidget;
  scope: DashboardScope;
}) {
  const { env } = opened;
  const [state, setState] = useState<WidgetState>({});
  const pin = usePin(app, widget, opened.datePreset, opened.customRange, opened.filters);
  const first = planWidget(prepared, env, state);
  const discovered = useToolResults(app, first.status === 'ready' ? first.discover : [], opened.projectId);
  // Planned again with the discover answers so far; both lists go out in the same render.
  const plan = planWidget(prepared, env, state, discovered.results);
  const sent = useToolResults(app, plan.status === 'ready' ? plan.requests : [], opened.projectId);
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
      scope={scope}
      pin={pin}
    />
  );
}

/**
 * Lays the dashboard's rows out on Studio's 12-column grid. Each widget is checked and drawn on its
 * own: one that fails to parse, query or render shows its own error and the rest still draw. Rows
 * whose widgets are all hidden at the scope leave no gap.
 */
function OpenedDashboard({ app, opened }: { app: App; opened: ReadyOpened }) {
  // A host that passes a project draws the project's widgets; without one, the org's.
  const scope: DashboardScope = opened.projectId ? 'project' : 'org';
  const rows = opened.dashboard.rows
    .map(row => row.widgets.map(widget => ({ widget, prepared: prepareWidget(widget, REGISTRY, scope) })))
    .map(cells => cells.filter(cell => cell.prepared.ok !== 'hidden'))
    .filter(cells => cells.length > 0);
  if (rows.length === 0) {
    return (
      <AppMessage tone="info" title="Nothing to show">
        None of this dashboard's widgets are shown {scope === 'project' ? 'for a project' : 'across projects'}.
      </AppMessage>
    );
  }

  return (
    <DashboardGrid>
      {rows.map(cells => (
        <DashboardGridRow key={cells[0]!.widget.id}>
          {cells.map(({ widget, prepared }) => (
            <DashboardGridCell key={widget.id} id={widget.id} span={widget.span}>
              <WidgetBoundary widget={widget}>
                {prepared.ok === true ? (
                  <Widget app={app} opened={opened} widget={widget} prepared={prepared} scope={scope} />
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
 * `datePreset` names and under its `defaults.filters`, unless the host's view
 * (`OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY`) sets them. Every read goes through the server's app-only
 * `queryObservability` tool, so the server decides where the data comes from.
 */
export function ObservabilityWidget() {
  // A preset window ends when the dashboard opens, and again each time the host's view changes.
  const [shown, setShown] = useState<{ content: unknown; view: ObservabilityWidgetView; now: number }>();
  // A failed read is shown with a retry button; the server's tool decides whether to retry itself.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  const { app, error } = useApp({
    appInfo: { name: 'Mastra observability widget', version: '1.0.0' },
    capabilities: {},
    onAppCreated: app => {
      app.ontoolresult = result =>
        setShown({
          content: result.structuredContent,
          view: readView(app.getHostContext()?.[OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY]),
          now: Date.now(),
        });
      app.onhostcontextchanged = context => {
        applyTheme(context.theme);
        // The host sends only what changed, so a pin leaves the window alone.
        if (!(OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY in context)) return;
        const view = readView(context[OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY]);
        setShown(current => current && { ...current, view, now: Date.now() });
      };
    },
  });
  useEffect(() => applyTheme(app?.getHostContext()?.theme), [app]);
  const opened = useMemo(() => shown && readOpened(shown.content, shown.now, shown.view), [shown]);

  if (error) {
    return (
      <AppMessage tone="error" title="Couldn't connect to the host">
        {error.message}
      </AppMessage>
    );
  }
  if (!app || !opened) {
    return (
      <AppState>
        <Spinner size="sm" aria-label="Loading the dashboard" className="mx-auto" />
      </AppState>
    );
  }
  if (opened.status === 'error') {
    return (
      <AppMessage tone="error" title="Couldn't draw the dashboard">
        {opened.message}
      </AppMessage>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* A new window starts the widgets over; a custom one can keep its end and move only its start. */}
      <OpenedDashboard
        key={`${opened.env.window.start.getTime()}-${opened.env.window.end.getTime()}`}
        app={app}
        opened={opened}
      />
    </QueryClientProvider>
  );
}

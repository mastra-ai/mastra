import type { DashboardDefinition, DashboardWidget } from '@mastra/client-js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { MockMastraClientProvider } from '../../../../.storybook/mocks/mastra-react';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import type { DatePreset } from '../../metrics/hooks/use-metrics';
import { DashboardGrid, DashboardGridCell, DashboardGridRow } from '../components/dashboard-grid';
import { DashboardRenderer } from '../components/dashboard-renderer';
import type { DashboardScope } from '../lib/definition';
import { createFakeMastraClient, FAKE_SCORERS } from './__tests__/fixtures/fake-mastra-client';
import { draftToWidget, widgetToDraft } from './codec';
import { DEFAULT_VIEW_LABEL, emptyView, metricKey } from './draft';
import type { WidgetDraft } from './draft';
import { WidgetEditor } from './widget-editor';
import type { WidgetEditorChange } from './widget-editor';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

const SCORERS = FAKE_SCORERS.map(s => ({ scorerId: s.scorerId, name: s.scorerName }));

/** A widget the editor made: token usage as stacked bars, with a second view for model cost. */
const tokensDraft: WidgetDraft = {
  id: 'tokens-by-model',
  span: 6,
  title: 'Tokens and cost',
  kind: 'stackedBar',
  kindPicked: true,
  views: [
    {
      ...emptyView('Tokens'),
      metrics: [
        { key: metricKey(), entry: 'input-tokens' },
        { key: metricKey(), entry: 'output-tokens' },
      ],
    },
    { ...emptyView('Cost'), metrics: [{ key: metricKey(), entry: 'model-cost' }] },
  ],
};

/** A table the editor made: agent runs and latency per entity, compared with the previous period. */
const entitiesDraft: WidgetDraft = {
  id: 'runs-by-entity',
  span: 12,
  title: 'Runs by entity',
  kind: 'table',
  kindPicked: true,
  views: [
    {
      ...emptyView(DEFAULT_VIEW_LABEL),
      splitBy: 'entityName',
      compare: true,
      metrics: [
        { key: metricKey(), entry: 'agent-runs' },
        { key: metricKey(), entry: 'agent-latency', aggregation: 'avg', lowerIsBetter: true },
      ],
    },
  ],
};

function encode(draft: WidgetDraft): DashboardWidget {
  const { widget, issues } = draftToWidget(draft, SCORERS);
  if (!widget) throw new Error(`Story fixture "${draft.id}" doesn't encode: ${issues.join(' ')}`);
  return widget;
}

const EMPTY: DashboardDefinition = { schemaVersion: 1, rows: [] };
const SEEDED: DashboardDefinition = {
  schemaVersion: 1,
  rows: [{ widgets: [encode(tokensDraft)] }, { widgets: [encode(entitiesDraft)] }],
};

/** Inserts a new widget at the end of the last row when it fits, else on a new row; replaces one with its id. */
function saveWidget(definition: DashboardDefinition, widget: DashboardWidget): DashboardDefinition {
  const exists = definition.rows.some(r => r.widgets.some(w => w.id === widget.id));
  if (exists) {
    return {
      ...definition,
      rows: definition.rows.map(r => ({ ...r, widgets: r.widgets.map(w => (w.id === widget.id ? widget : w)) })),
    };
  }
  const last = definition.rows.at(-1);
  const used = last?.widgets.reduce((sum, w) => sum + w.span, 0) ?? 12;
  if (last && used + widget.span <= 12) {
    return { ...definition, rows: [...definition.rows.slice(0, -1), { ...last, widgets: [...last.widgets, widget] }] };
  }
  return { ...definition, rows: [...definition.rows, { widgets: [widget] }] };
}

type HarnessProps = { initial: DashboardDefinition; scope: DashboardScope; startOpen?: 'create' | string };

function Harness({ initial, scope, startOpen }: HarnessProps) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [client] = useState(createFakeMastraClient);
  const [preset, setPreset] = useState<DatePreset>('24h');
  const [definition, setDefinition] = useState(initial);
  // The page names the widget up front, so a new one has its id before it can be saved.
  const [editing, setEditing] = useState<string | undefined>(startOpen === 'create' ? nanoid() : startOpen);
  const [change, setChange] = useState<WidgetEditorChange>();
  const widgets = definition.rows.flatMap(r => r.widgets);
  const creating = editing !== undefined && !widgets.some(w => w.id === editing);

  const stop = () => {
    setEditing(undefined);
    setChange(undefined);
  };
  const editor = (widgetId: string) => (
    <WidgetEditor key={widgetId} definition={definition} widgetId={widgetId} scope={scope} onChange={setChange} />
  );

  return (
    <MockMastraClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider preset={preset} onPresetChange={setPreset} filterTokens={[]} onFilterTokensChange={() => {}}>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Button
                    variant="primary"
                    icon={<CheckIcon />}
                    disabled={!change?.widget}
                    title={change?.issues[0]}
                    onClick={() => {
                      const widget = change?.widget;
                      if (widget) setDefinition(d => saveWidget(d, widget));
                      stop();
                    }}
                  >
                    Done
                  </Button>
                  <Button onClick={stop}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button variant="primary" icon={<PlusIcon />} onClick={() => setEditing(nanoid())}>
                    Add widget
                  </Button>
                  {widgets.map(w =>
                    widgetToDraft(w, SCORERS) ? (
                      <Button key={w.id} icon={<PencilIcon />} onClick={() => setEditing(w.id)}>
                        Edit {w.title}
                      </Button>
                    ) : null,
                  )}
                </>
              )}
            </div>
            {widgets.length > 0 && (
              <DashboardRenderer
                definition={definition}
                scope={scope}
                renderWidget={w => (w.id === editing ? editor(w.id) : undefined)}
              />
            )}
            {/* A new widget isn't on the dashboard until it's done, so it gets a row of its own below. */}
            {creating && (
              <DashboardGrid>
                <DashboardGridRow>
                  <DashboardGridCell span={change?.span ?? 6}>{editor(editing)}</DashboardGridCell>
                </DashboardGridRow>
              </DashboardGrid>
            )}
            {widgets.length === 0 && !editing && (
              <Txt variant="body" tone="muted">
                No widgets yet. Add one to see it on the page.
              </Txt>
            )}
          </div>
        </MetricsProvider>
      </QueryClientProvider>
    </MockMastraClientProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Dashboards/WidgetEditor',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  args: { scope: 'project' },
  argTypes: {
    scope: { control: 'inline-radio', options: ['org', 'project'] },
    initial: { table: { disable: true } },
    startOpen: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

/** An empty page; a blank widget opens with its settings open on the metric picker. */
export const Create: Story = {
  args: { initial: EMPTY, startOpen: 'create' },
};

/** The editor opens on the stacked-bar widget with two views. */
export const EditTimeseries: Story = {
  args: { initial: SEEDED, startOpen: tokensDraft.id },
};

/** The editor opens on the table, split by entity and compared with the previous period. */
export const EditTable: Story = {
  args: { initial: SEEDED, startOpen: entitiesDraft.id },
};

/** The page with editor-made widgets, nothing open: add or edit from the buttons, then Done or Cancel. */
export const Page: Story = {
  args: { initial: SEEDED },
};

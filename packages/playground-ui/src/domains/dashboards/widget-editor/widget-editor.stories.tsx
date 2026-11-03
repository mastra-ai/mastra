import type { DashboardDefinition, DashboardWidget } from '@mastra/client-js';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { MockMastraClientProvider } from '../../../../.storybook/mocks/mastra-react';
import { MetricsProvider } from '../../metrics/hooks/use-metrics';
import type { DatePreset } from '../../metrics/hooks/use-metrics';
import type { DashboardScope } from '../lib/definition';
import { insertWidget as insertLayoutWidget, removeWidget as removeLayoutWidget } from '../widget-layout/layout';
import type { WidgetLayoutItem, WidgetLayoutRow } from '../widget-layout/layout';
import { WidgetLayout } from '../widget-layout/widget-layout';
import type { WidgetDragHandleProps } from '../widget-layout/widget-layout';
import { createFakeMastraClient } from './__tests__/fixtures/fake-mastra-client';
import { WidgetEditor } from './widget-editor';
import type { WidgetEditorChange } from './widget-editor';
import { Button } from '@/ds/components/Button';

/** The saved widgets in the layout's order and widths; a widget still being created isn't saved yet. */
function toDefinition(rows: WidgetLayoutRow[], saved: Record<string, DashboardWidget>): DashboardDefinition {
  return {
    schemaVersion: 1,
    rows: rows
      .map(row => ({
        widgets: row.widgets.flatMap(({ id, span }) => {
          const widget = saved[id];
          return widget ? [{ ...widget, span }] : [];
        }),
      }))
      .filter(row => row.widgets.length > 0),
  };
}

function Harness({ scope }: { scope: DashboardScope }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [client] = useState(createFakeMastraClient);
  const [preset, setPreset] = useState<DatePreset>('24h');
  // The layout owns where widgets sit and how wide they are; each widget's editor owns what it shows.
  const [rows, setRows] = useState<WidgetLayoutRow[]>([]);
  const [saved, setSaved] = useState<Record<string, DashboardWidget>>({});
  const definition = toDefinition(rows, saved);

  const add = () => {
    const next = insertLayoutWidget(rows, nanoid(), { type: 'row', rowIndex: rows.length });
    if (next) setRows(next);
  };
  const remove = (widgetId: string) => {
    setRows(r => removeLayoutWidget(r, widgetId));
    setSaved(({ [widgetId]: _, ...rest }) => rest);
  };
  // Every widget is edited in place; the last version that could be saved is kept.
  const keep = (widgetId: string, { widget }: WidgetEditorChange) => {
    if (widget) setSaved(s => ({ ...s, [widgetId]: widget }));
  };

  const renderWidget = ({ id }: WidgetLayoutItem, dragHandle: WidgetDragHandleProps) => (
    <WidgetEditor
      key={id}
      definition={definition}
      widgetId={id}
      scope={scope}
      onChange={change => keep(id, change)}
      onRemove={() => remove(id)}
      dragHandle={dragHandle}
    />
  );

  return (
    <MockMastraClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider preset={preset} onPresetChange={setPreset} filterTokens={[]} onFilterTokensChange={() => {}}>
          <div className="flex min-h-screen flex-col gap-4 p-6">
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <Button variant="primary" icon={<PlusIcon />} onClick={add}>
                  Add widget
                </Button>
              </div>
            ) : (
              <WidgetLayout
                rows={rows}
                onRowsChange={setRows}
                renderWidget={renderWidget}
                createWidget={() => nanoid()}
              />
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
  },
};

export default meta;
type Story = StoryObj<typeof Harness>;

/**
 * An empty canvas with one "Add widget" button; once the canvas has widgets, the + on any gap of the layout adds
 * one there. Every widget
 * is edited in place; drag one by the grip left of its title to rearrange it, and resize it on the layout.
 */
export const Canvas: Story = {};

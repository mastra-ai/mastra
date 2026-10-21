import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CircleDotIcon, KanbanIcon, ListIcon, UserIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod/v4';
import { SavedViewEditor } from './saved-view-editor';
import { SavedViewSummary, SavedViewSummaryFilters, SavedViewSummaryRow } from './saved-view-summary';
import { SavedViewTabs } from './saved-view-tabs';
import { localStorageSavedViewsBackend } from './saved-views-backend';
import { useSavedViews } from './use-saved-views';
import { DEFAULT_FILTER_OPERATORS } from '@/ds/components/FilterBar/default-operators';
import { FilterBar } from '@/ds/components/FilterBar/filter-bar';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar/types';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const layoutSchema = z.enum(['list', 'board']);
const stateSchema = z.object({
  layout: layoutSchema.catch('list'),
  filters: z.array(
    z.object({
      id: z.string(),
      fieldId: z.string(),
      operatorId: z.string(),
      value: z.union([scalarSchema, z.array(scalarSchema)]),
    }),
  ),
});
type Layout = z.infer<typeof layoutSchema>;
const DEFAULT_LAYOUT: Layout = 'list';

const FIELDS: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    icon: CircleDotIcon,
    operators: ['is', 'is-not'],
    strict: true,
    suggestions: [{ value: 'open' }, { value: 'closed' }],
  },
  {
    id: 'author',
    label: 'Author',
    icon: UserIcon,
    operators: ['is'],
    strict: true,
    suggestions: [
      { value: 'factory:ada', label: 'Ada (Factory)' },
      { value: 'github:ada', label: 'ada (GitHub)' },
    ],
  },
];

const queryClient = new QueryClient();

const meta: Meta = {
  title: 'Composite/SavedViews',
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Saved views for a `FilterBar` page. Views live in a backend (`localStorageSavedViewsBackend` here, or any async API) read through React Query, and every view’s `state` is checked with the page’s schema when it is read.',
          '',
          'The page owns what it shows: pass it as `current` and put a view on the page in `onApply`. Changing the page while a view is active shows "Save to this view" and "Reset changes". The layers button saves what the page shows as a new view. Clicking the active view tab opens its menu: rename, duplicate or delete (after a confirmation). Hovering another tab previews its filters and settings.',
        ].join('\n'),
      },
    },
  },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: function SavedViewsStory() {
    const [activeViewId, setActiveViewId] = useState<string>();
    const [filters, setFilters] = useState<FilterBarItem[]>([]);
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
    const views = useSavedViews({
      backend: localStorageSavedViewsBackend('storybook.savedViews'),
      schema: stateSchema,
      activeViewId,
      current: { filters, layout },
      onApply: view => {
        setActiveViewId(view?.id);
        setFilters(view?.state.filters ?? []);
        setLayout(view?.state.layout ?? DEFAULT_LAYOUT);
      },
      onActiveViewChange: setActiveViewId,
    });
    return (
      <div className="grid w-full max-w-3xl gap-3">
        <SavedViewTabs
          views={views}
          defaultLabel="All issues"
          renderSummary={view => (
            <SavedViewSummary>
              <SavedViewSummaryFilters
                filters={view.state.filters}
                fields={FIELDS}
                operators={DEFAULT_FILTER_OPERATORS}
              />
              <SavedViewSummaryRow label="Layout" value={view.state.layout} />
            </SavedViewSummary>
          )}
        />
        <SavedViewEditor views={views}>
          <FilterBar fields={FIELDS} operators={DEFAULT_FILTER_OPERATORS} value={filters} onValueChange={setFilters}>
            <FilterBar.Chips />
            <FilterBar.Input placeholder="Filter issues…" />
          </FilterBar>
          <SegmentedControl aria-label="Layout" size="sm" iconOnly value={layout} onValueChange={setLayout}>
            <SegmentedControlItem value="list" aria-label="List" title="List">
              <ListIcon aria-hidden />
            </SegmentedControlItem>
            <SegmentedControlItem value="board" aria-label="Board" title="Board">
              <KanbanIcon aria-hidden />
            </SegmentedControlItem>
          </SegmentedControl>
        </SavedViewEditor>
        <pre className="rounded-lg bg-card p-3 text-meta text-muted-foreground">
          {JSON.stringify({ activeViewId, unsaved: views.unsaved, state: { filters, layout } }, null, 2)}
        </pre>
      </div>
    );
  },
};

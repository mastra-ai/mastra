import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleDotIcon, KanbanIcon, ListIcon, UserIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod/v4';
import { SavedViewEditor } from './saved-view-editor';
import { SavedViewTabs } from './saved-view-tabs';
import { useSavedViews } from './use-saved-views';
import { DEFAULT_FILTER_OPERATORS } from '@/ds/components/FilterBar/default-operators';
import { FilterBar } from '@/ds/components/FilterBar/filter-bar';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar/types';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Txt } from '@/ds/components/Txt';

const layoutSchema = z.enum(['list', 'board']);
const settingsSchema = z.object({ layout: layoutSchema.catch('list') });
type Settings = z.infer<typeof settingsSchema>;

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

const meta: Meta = {
  title: 'Composite/SavedViews',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Saved views for a `FilterBar` page, stored in localStorage and validated with Zod on every read.',
          '',
          'Clicking the active view tab opens its menu: edit, rename, duplicate or delete. Hovering another tab previews its filters, and right-clicking any tab opens the same menu. The layers button starts an empty view with the current page settings; `SavedViewEditor` holds the draft until it is saved.',
          'Editing filters keeps the selected tab in place. Unsaved changes have explicit Save changes and Reset actions. Keep temporary content search separate from the saved filters so searching does not edit the view.',
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
    const [pageFilters, setPageFilters] = useState<FilterBarItem[]>([]);
    const [pageLayout, setPageLayout] = useState<Settings['layout']>('list');
    const views = useSavedViews<Settings>({
      storageKey: 'storybook.savedViews',
      settingsSchema,
      activeViewId,
      onActiveViewChange: setActiveViewId,
    });
    const settings = views.applied?.settings ?? { layout: pageLayout };
    const filters = views.applied?.filters ?? pageFilters;
    const setFilters = (next: FilterBarItem[]) => {
      if (views.applied) views.change({ filters: next });
      else setPageFilters(next);
    };
    const setLayout = (layout: Settings['layout']) => {
      if (views.applied) views.change({ settings: { layout } });
      else setPageLayout(layout);
    };
    return (
      <div className="grid w-full max-w-3xl gap-3">
        <SavedViewTabs
          views={views}
          fields={FIELDS}
          operators={DEFAULT_FILTER_OPERATORS}
          defaultLabel="All issues"
          newViewSettings={{ layout: pageLayout }}
          describeSettings={viewSettings => (
            <Txt variant="caption" tone="muted">
              Layout: {viewSettings.layout}
            </Txt>
          )}
        />
        <SavedViewEditor views={views}>
          <FilterBar fields={FIELDS} operators={DEFAULT_FILTER_OPERATORS} value={filters} onValueChange={setFilters}>
            <FilterBar.Chips />
            <FilterBar.Input placeholder="Filter issues…" />
          </FilterBar>
          <SegmentedControl aria-label="Layout" size="sm" iconOnly value={settings.layout} onValueChange={setLayout}>
            <SegmentedControlItem value="list" aria-label="List" title="List">
              <ListIcon aria-hidden />
            </SegmentedControlItem>
            <SegmentedControlItem value="board" aria-label="Board" title="Board">
              <KanbanIcon aria-hidden />
            </SegmentedControlItem>
          </SegmentedControl>
        </SavedViewEditor>
        <pre className="rounded-lg bg-card p-3 text-meta text-muted-foreground">
          {JSON.stringify(views.applied ?? { filters, settings }, null, 2)}
        </pre>
      </div>
    );
  },
};

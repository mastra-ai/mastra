import type { SavedViewPage } from '@mastra/core/storage';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router';
import { logsView, spansView, threadsView, tracesView } from '../__tests__/fixtures/saved-view-pages';
import { createInMemorySavedViewsSource } from './__tests__/fixtures/in-memory-source';
import { ObservabilitySavedViews } from './observability-saved-views';
import { SavedViewsProvider } from './saved-views-provider';
import { TRACE_COLUMN_CATALOGS } from '@/domains/traces/trace-list-columns';
import { Txt } from '@/ds/components/Txt';

const VIEWS = { traces: tracesView, spans: spansView, threads: threadsView, logs: logsView };

function PageUrl({ page }: { page: SavedViewPage }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Stands in for the page's column picker.
  const [preferences, setPreferences] = useState(TRACE_COLUMN_CATALOGS[page === 'logs' ? 'traces' : page].defaults);
  const columns = {
    preferences,
    setPreferences,
    resetColumns: () => setPreferences(TRACE_COLUMN_CATALOGS[page === 'logs' ? 'traces' : page].defaults),
  };
  return (
    <div className="flex flex-col gap-4">
      <ObservabilitySavedViews
        page={page}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        columns={page === 'logs' ? undefined : columns}
      />
      <Txt variant="caption" tone="muted" className="font-mono break-all">
        ?{searchParams.toString()}
      </Txt>
    </div>
  );
}

function HostedSavedViews({ page }: { page: SavedViewPage }) {
  const [queryClient] = useState(() => new QueryClient());
  const [source] = useState(() =>
    createInMemorySavedViewsSource([
      { name: 'Errors last week', state: VIEWS[page] },
      { name: 'Shared triage', state: { schemaVersion: 1, page, filters: [] }, scope: 'org' },
    ]),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SavedViewsProvider source={source} queryKeyScope={['story', page]}>
        <MemoryRouter>
          <PageUrl page={page} />
        </MemoryRouter>
      </SavedViewsProvider>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof HostedSavedViews> = {
  title: 'Observability/SavedViews',
  component: HostedSavedViews,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Saved views of an observability list page, stored by the host. Wrap the page in a `SavedViewsProvider` with a `SavedViewsSource` (list, create, update, remove); without one the bar renders nothing.',
          '',
          'The page URL is the draft: picking a view writes it to the URL, and the view shows unsaved changes while the URL differs. A source rejects a duplicate name with `SavedViewNameTakenError`. This story keeps views in memory.',
        ].join('\n'),
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof HostedSavedViews>;

export const Traces: Story = { args: { page: 'traces' } };
export const Spans: Story = { args: { page: 'spans' } };
export const Threads: Story = { args: { page: 'threads' } };
export const Logs: Story = { args: { page: 'logs' } };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DataList } from '../data-list';
import type { DataListSortDirection } from '../data-list';
import { TabbedContainer } from './tabbed-container';
import { cn } from '@/lib/utils';

const meta: Meta<typeof TabbedContainer> = {
  title: 'DataDisplay/TabbedContainer',
  component: TabbedContainer,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof TabbedContainer>;

const SAMPLE_RUNS = [
  {
    id: 'run_8f3a91b2c4d6e8f0',
    input: 'What is the weather in Tokyo?',
    status: 'success',
    createdAt: '2026-05-21T09:14:22.123Z',
  },
  {
    id: 'run_2e7c89d1a3b5f7e9',
    input: 'Summarize the latest sales report',
    status: 'success',
    createdAt: '2026-05-21T08:42:11.456Z',
  },
  {
    id: 'run_5a1b4c7d9e2f3a6b',
    input: 'Translate hello to Japanese',
    status: 'failed',
    createdAt: '2026-05-20T17:03:55.789Z',
  },
  {
    id: 'run_9d4e7f2a5c8b1d3e',
    input: 'Generate a recipe for banana bread',
    status: 'success',
    createdAt: '2026-05-20T11:21:08.012Z',
  },
];

const SAMPLE_SCORES = [
  { id: 'score_1b2c3d4e5f6a7b8c', scorer: 'answer-relevancy', score: 0.92, createdAt: '2026-05-21T09:15:02.001Z' },
  { id: 'score_2c3d4e5f6a7b8c9d', scorer: 'toxicity', score: 0.01, createdAt: '2026-05-21T09:15:04.210Z' },
  { id: 'score_3d4e5f6a7b8c9d0e', scorer: 'faithfulness', score: 0.87, createdAt: '2026-05-21T08:43:00.930Z' },
];

const manyRuns = Array.from({ length: 8 }, (_, index) =>
  SAMPLE_RUNS.map(run => ({ ...run, id: `${run.id}_${index}` })),
).flat();

type RunSort = {
  key: keyof (typeof SAMPLE_RUNS)[number];
  direction: DataListSortDirection;
};

function sortRuns(runs: typeof manyRuns, sort: RunSort) {
  const multiplier = sort.direction === 'ascending' ? 1 : -1;
  return runs.toSorted((left, right) => left[sort.key].localeCompare(right[sort.key]) * multiplier);
}

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
];

export const Default: Story = {
  render: function DefaultStory() {
    const [runSearch, setRunSearch] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [runSort, setRunSort] = useState<RunSort>({ key: 'createdAt', direction: 'descending' });
    const runs = sortRuns(
      manyRuns.filter(
        run =>
          run.input.toLowerCase().includes(runSearch.toLowerCase()) &&
          (selectedStatuses.length === 0 || selectedStatuses.includes(run.status)),
      ),
      runSort,
    );

    return (
      <div className="w-full max-w-4xl" style={{ height: 400 }}>
        <TabbedContainer defaultTab="overview" className="h-full">
          <TabbedContainer.Panel value="overview" label="Overview">
            <div className="grid gap-1">
              <h2 className={cn('text-ui-md', 'font-medium', 'text-neutral5')}>Evaluation overview</h2>
              <p className="text-ui-sm text-neutral3">Any product content can share the frame with data-heavy tabs.</p>
            </div>
          </TabbedContainer.Panel>
          <TabbedContainer.DataList
            value="runs"
            label="Runs"
            columns="auto minmax(0,1fr) auto auto auto"
            search={{
              label: 'Search runs',
              placeholder: 'Search runs',
              value: runSearch,
              onSearch: setRunSearch,
            }}
            filter={{
              'aria-label': 'Filter by status',
              multiple: true,
              options: STATUS_OPTIONS,
              placeholder: 'Status',
              searchPlaceholder: 'Search statuses',
              value: selectedStatuses,
              onValueChange: setSelectedStatuses,
            }}
          >
            <DataList.Top>
              <DataList.SortableTopCell
                sortDirection={runSort.key === 'id' ? runSort.direction : undefined}
                onSortChange={direction => setRunSort({ key: 'id', direction })}
              >
                ID
              </DataList.SortableTopCell>
              <DataList.SortableTopCell
                sortDirection={runSort.key === 'input' ? runSort.direction : undefined}
                onSortChange={direction => setRunSort({ key: 'input', direction })}
              >
                Input
              </DataList.SortableTopCell>
              <DataList.SortableTopCell
                sortDirection={runSort.key === 'status' ? runSort.direction : undefined}
                onSortChange={direction => setRunSort({ key: 'status', direction })}
              >
                Status
              </DataList.SortableTopCell>
              <DataList.SortableTopCell
                sortDirection={runSort.key === 'createdAt' ? runSort.direction : undefined}
                defaultSortDirection="descending"
                onSortChange={direction => setRunSort({ key: 'createdAt', direction })}
              >
                Date
              </DataList.SortableTopCell>
              <DataList.TopCell>Time</DataList.TopCell>
            </DataList.Top>
            {runs.map(run => (
              <DataList.RowButton key={run.id} onClick={() => {}}>
                <DataList.IdCell id={run.id} />
                <DataList.TextCell>{run.input}</DataList.TextCell>
                <DataList.Cell>{run.status}</DataList.Cell>
                <DataList.DateCell timestamp={run.createdAt} />
                <DataList.TimeCell timestamp={run.createdAt} />
              </DataList.RowButton>
            ))}
            {runs.length === 0 && <DataList.NoMatch message="No runs match the search" />}
          </TabbedContainer.DataList>
          <TabbedContainer.DataList value="scores" label="Scores" columns="auto minmax(0,1fr) auto auto">
            <DataList.Top>
              <DataList.TopCell>ID</DataList.TopCell>
              <DataList.TopCell>Scorer</DataList.TopCell>
              <DataList.TopCell>Score</DataList.TopCell>
              <DataList.TopCell>Date</DataList.TopCell>
            </DataList.Top>
            {SAMPLE_SCORES.map(score => (
              <DataList.RowButton key={score.id} onClick={() => {}}>
                <DataList.IdCell id={score.id} />
                <DataList.TextCell>{score.scorer}</DataList.TextCell>
                <DataList.NumberCell>{score.score.toFixed(2)}</DataList.NumberCell>
                <DataList.DateCell timestamp={score.createdAt} />
              </DataList.RowButton>
            ))}
          </TabbedContainer.DataList>
        </TabbedContainer>
      </div>
    );
  },
};

const OVERFLOW_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'runs', label: 'Runs' },
  { value: 'scores', label: 'Scores' },
  { value: 'logs', label: 'Logs' },
  { value: 'metrics', label: 'Metrics' },
  { value: 'traces', label: 'Traces' },
  { value: 'datasets', label: 'Datasets' },
];

export const OverflowAndClosable: Story = {
  render: function OverflowAndClosableStory() {
    const [activeTab, setActiveTab] = useState('runs');
    const [visibleTabs, setVisibleTabs] = useState(OVERFLOW_TABS.map(tab => tab.value));
    const [search, setSearch] = useState('');
    const closeTab = (value: string) =>
      visibleTabs.length > 1
        ? () => {
            const nextTabs = visibleTabs.filter(tab => tab !== value);
            if (activeTab === value) {
              const closedIndex = visibleTabs.indexOf(value);
              const nextActiveTab = nextTabs[Math.min(closedIndex, nextTabs.length - 1)];
              if (nextActiveTab) setActiveTab(nextActiveTab);
            }
            setVisibleTabs(nextTabs);
          }
        : undefined;

    return (
      <div className="h-80 w-full max-w-3xl">
        <TabbedContainer defaultTab="runs" value={activeTab} onValueChange={setActiveTab} className="h-full">
          {OVERFLOW_TABS.filter(tab => visibleTabs.includes(tab.value)).map(tab =>
            tab.value === 'overview' ? (
              <TabbedContainer.Panel key={tab.value} value={tab.value} label={tab.label} onClose={closeTab(tab.value)}>
                <div className="grid gap-1">
                  <h2 className={cn('text-ui-md', 'font-medium', 'text-neutral5')}>Workspace overview</h2>
                  <p className="text-ui-sm text-neutral3">Arbitrary content shares the same closable tab rail.</p>
                </div>
              </TabbedContainer.Panel>
            ) : (
              <TabbedContainer.DataList
                key={tab.value}
                value={tab.value}
                label={tab.label}
                columns="1fr auto"
                onClose={closeTab(tab.value)}
                search={
                  tab.value === 'runs'
                    ? { label: 'Search runs', placeholder: 'Search runs', value: search, onSearch: setSearch }
                    : undefined
                }
              >
                <DataList.Top>
                  <DataList.TopCell>Name</DataList.TopCell>
                  <DataList.TopCell>Type</DataList.TopCell>
                </DataList.Top>
                <DataList.RowStatic>
                  <DataList.TextCell>{`${tab.label} item`}</DataList.TextCell>
                  <DataList.Cell>DataList</DataList.Cell>
                </DataList.RowStatic>
              </TabbedContainer.DataList>
            ),
          )}
        </TabbedContainer>
      </div>
    );
  },
};

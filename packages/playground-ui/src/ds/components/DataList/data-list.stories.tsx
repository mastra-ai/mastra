import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { DataList } from './data-list';
import { DataListSkeleton } from './data-list-skeleton';
import { Button } from '@/ds/components/Button';
import { useTableKeydown } from '@/lib/keyboard';

const meta: Meta<typeof DataList> = {
  title: 'DataDisplay/DataList',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DataList>;

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

type SampleRun = (typeof SAMPLE_RUNS)[number];

const COLUMNS = 'auto minmax(0,1fr) auto auto auto';

function RunsHeader() {
  return (
    <DataList.Top>
      <DataList.TopCell>ID</DataList.TopCell>
      <DataList.TopCell>Input</DataList.TopCell>
      <DataList.TopCell>Status</DataList.TopCell>
      <DataList.TopCell>Date</DataList.TopCell>
      <DataList.TopCell>Time</DataList.TopCell>
    </DataList.Top>
  );
}

function RunCells({ run }: { run: SampleRun }) {
  return (
    <>
      <DataList.IdCell id={run.id} />
      <DataList.TextCell>{run.input}</DataList.TextCell>
      <DataList.Cell>{run.status}</DataList.Cell>
      <DataList.DateCell timestamp={run.createdAt} />
      <DataList.TimeCell timestamp={run.createdAt} />
    </>
  );
}

/** Canonical DataList appearance and density. */
export const Default: Story = {
  render: () => (
    <DataList columns={COLUMNS}>
      <RunsHeader />
      {SAMPLE_RUNS.map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <RunCells run={run} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** `light` drops the panel behind the rows so the list sits directly on the page. */
export const Light: Story = {
  render: () => (
    <DataList columns={COLUMNS} variant="light">
      <RunsHeader />
      {SAMPLE_RUNS.map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <RunCells run={run} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** Semantic error and featured row states. */
export const RowStates: Story = {
  render: () => (
    <DataList columns={COLUMNS}>
      <RunsHeader />
      {SAMPLE_RUNS.map((run, index) => (
        <DataList.RowButton
          key={run.id}
          onClick={() => {}}
          variant={run.status === 'failed' ? 'error' : 'default'}
          featured={index === 1}
        >
          <RunCells run={run} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** Multi-select with checkboxes that remain visible without hover. */
export const WithSelection: Story = {
  render: function WithSelectionStory() {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const allIds = SAMPLE_RUNS.map(run => run.id);
    const allSelected = selected.size === allIds.length;
    const someSelected = selected.size > 0 && !allSelected;

    const toggle = (id: string) => {
      setSelected(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <DataList columns={`auto ${COLUMNS}`}>
        <DataList.Top hasLeadingCell>
          <DataList.TopSelectCell
            checked={someSelected ? 'indeterminate' : allSelected}
            onToggle={() => setSelected(allSelected ? new Set() : new Set(allIds))}
            aria-label="Select all"
          />
          <DataList.TopCells colStart={2}>
            <DataList.TopCell>ID</DataList.TopCell>
            <DataList.TopCell>Input</DataList.TopCell>
            <DataList.TopCell>Status</DataList.TopCell>
            <DataList.TopCell>Date</DataList.TopCell>
            <DataList.TopCell>Time</DataList.TopCell>
          </DataList.TopCells>
        </DataList.Top>
        {SAMPLE_RUNS.map(run => (
          <DataList.RowWrapper key={run.id}>
            <DataList.SelectCell
              checked={selected.has(run.id)}
              onToggle={() => toggle(run.id)}
              aria-label={`Select ${run.id}`}
            />
            <DataList.RowButton colStart={2} onClick={() => toggle(run.id)}>
              <RunCells run={run} />
            </DataList.RowButton>
          </DataList.RowWrapper>
        ))}
      </DataList>
    );
  },
};

/** Trailing actions stay hidden until their row is hovered or focused. */
export const WithActions: Story = {
  render: () => (
    <DataList columns="minmax(8rem,auto) minmax(8rem,1fr) minmax(0,2fr) auto">
      <DataList.Top>
        <DataList.TopCell>Name</DataList.TopCell>
        <DataList.TopCell>Path</DataList.TopCell>
        <DataList.TopCell>Description</DataList.TopCell>
        <DataList.TopCell> </DataList.TopCell>
      </DataList.Top>
      {[
        { name: 'web-search', path: '/skills/web-search', description: 'Search the web and return summaries.' },
        { name: 'file-system', path: '/skills/file-system', description: 'Read and write files in the workspace.' },
        { name: 'database', path: '/skills/database', description: 'Query the connected SQL database.' },
      ].map(item => (
        <DataList.RowWrapper key={item.path}>
          <DataList.RowButton colEnd={-2} onClick={() => {}}>
            <DataList.NameCell>{item.name}</DataList.NameCell>
            <DataList.TextCell font="mono">{item.path}</DataList.TextCell>
            <DataList.DescriptionCell>{item.description}</DataList.DescriptionCell>
          </DataList.RowButton>
          <DataList.ActionsCell>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tooltip={`Edit ${item.name}`}
              aria-label={`Edit ${item.name}`}
              onClick={event => event.stopPropagation()}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tooltip={`Delete ${item.name}`}
              aria-label={`Delete ${item.name}`}
              onClick={event => event.stopPropagation()}
            >
              <Trash2 className="size-4" />
            </Button>
          </DataList.ActionsCell>
        </DataList.RowWrapper>
      ))}
    </DataList>
  ),
};

export const Empty: Story = {
  render: () => (
    <DataList columns={COLUMNS}>
      <RunsHeader />
      <DataList.NoMatch message="No runs match your search" />
    </DataList>
  ),
};

export const Loading: Story = {
  render: () => <DataListSkeleton columns={COLUMNS} numberOfRows={5} />,
};

/** Horizontal and vertical scrolling with a sticky header and first column. */
export const StickyOverflow: Story = {
  render: () => (
    <div className="max-w-190">
      <DataList
        columns="minmax(12rem,auto) auto auto auto auto auto auto auto"
        mask={{ left: false }}
        className="max-h-80"
      >
        <DataList.Top>
          <DataList.TopCell sticky="start">Resource</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Input</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Output</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cache read</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cache write</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Latency</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Runs</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
        </DataList.Top>
        {Array.from({ length: 12 }, (_, index) => (
          <DataList.RowButton key={index} onClick={() => {}}>
            <DataList.RowHeaderCell>Resource {index + 1}</DataList.RowHeaderCell>
            <DataList.NumberCell>{(index * 1300 + 6200).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{(index * 840 + 2100).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{(index * 260 + 900).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{(index * 120 + 300).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{180 + index * 24}ms</DataList.NumberCell>
            <DataList.NumberCell>{(index + 1) * 17}</DataList.NumberCell>
            <DataList.NumberCell highlight>${(index * 0.014 + 0.008).toFixed(3)}</DataList.NumberCell>
          </DataList.RowButton>
        ))}
      </DataList>
    </div>
  ),
};

export const WithPagination: Story = {
  render: function WithPaginationStory() {
    const [page, setPage] = useState(0);

    return (
      <DataList columns={COLUMNS}>
        <RunsHeader />
        {SAMPLE_RUNS.map(run => (
          <DataList.RowButton key={run.id} onClick={() => {}}>
            <RunCells run={run} />
          </DataList.RowButton>
        ))}
        <DataList.Pagination
          currentPage={page}
          hasMore={page < 3}
          onNextPage={() => setPage(current => current + 1)}
          onPrevPage={() => setPage(current => Math.max(0, current - 1))}
        />
      </DataList>
    );
  },
};

export const WithSubheaders: Story = {
  render: () => (
    <DataList columns={COLUMNS}>
      <RunsHeader />
      <DataList.Subheader>
        Today <DataList.SubHeading>2 runs</DataList.SubHeading>
      </DataList.Subheader>
      {SAMPLE_RUNS.slice(0, 2).map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <RunCells run={run} />
        </DataList.RowButton>
      ))}
      <DataList.Subheader>
        Yesterday <DataList.SubHeading>2 runs</DataList.SubHeading>
      </DataList.Subheader>
      {SAMPLE_RUNS.slice(2).map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <RunCells run={run} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** Roving focus with ArrowUp, ArrowDown, Home, End, PageUp and PageDown. */
export const KeyboardNavigation: Story = {
  render: function KeyboardNavigationStory() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { activeIndex, getRowProps } = useTableKeydown({
      count: SAMPLE_RUNS.length,
      containerRef,
    });

    return (
      <div ref={containerRef}>
        <DataList columns={COLUMNS}>
          <RunsHeader />
          {SAMPLE_RUNS.map((run, index) => (
            <DataList.RowButton
              key={run.id}
              featured={index === activeIndex}
              onClick={() => {}}
              {...getRowProps(index)}
            >
              <RunCells run={run} />
            </DataList.RowButton>
          ))}
        </DataList>
      </div>
    );
  },
};

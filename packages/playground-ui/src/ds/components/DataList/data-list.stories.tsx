import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { expect, within } from 'storybook/test';
import { DataList } from './data-list';
import type { DataListSort } from './data-list';
import { DataListSkeleton } from './data-list-skeleton';
import { ActionRow } from '@/ds/components/ActionRow';
import { Badge } from '@/ds/components/Badge/Badge';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox/combobox';
import { ListSearch } from '@/ds/components/ListSearch/list-search';
import { PropertyFilterApplied } from '@/ds/components/PropertyFilter/property-filter-applied';
import { PropertyFilterCreator } from '@/ds/components/PropertyFilter/property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { Status } from '@/ds/components/StatusIndicators';
import { Txt } from '@/ds/components/Txt/Txt';
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
  const failed = run.status === 'failed';
  const statusLabel = failed ? 'Failed' : 'Success';

  return (
    <>
      <DataList.IdCell id={run.id} />
      <DataList.TextCell>{run.input}</DataList.TextCell>
      <DataList.Cell>
        <Status
          presentation={
            failed
              ? { label: statusLabel, tone: 'error', description: 'The run failed.' }
              : { label: statusLabel, tone: 'success', description: 'The run completed successfully.' }
          }
        />
      </DataList.Cell>
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

/**
 * `reorderable` lets users drag header cells (or press Alt+Arrow on a focused header) to move columns.
 * The order persists in localStorage under the list `id`, which is required. Sticky columns stay pinned.
 */
export const Reorderable: Story = {
  render: () => (
    <div className="max-w-190">
      <DataList
        columns="minmax(12rem,auto) auto auto auto auto auto"
        mask={{ left: false }}
        reorderable
        id="storybook-usage"
      >
        <DataList.Top>
          <DataList.TopCell sticky="start">Resource</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Input</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Output</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Latency</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Runs</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
        </DataList.Top>
        {Array.from({ length: 5 }, (_, index) => (
          <DataList.RowButton key={index} onClick={() => {}}>
            <DataList.RowHeaderCell>Resource {index + 1}</DataList.RowHeaderCell>
            <DataList.NumberCell>{(index * 1300 + 6200).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{(index * 840 + 2100).toLocaleString()}</DataList.NumberCell>
            <DataList.NumberCell>{180 + index * 24}ms</DataList.NumberCell>
            <DataList.NumberCell>{(index + 1) * 17}</DataList.NumberCell>
            <DataList.NumberCell highlight>${(index * 0.014 + 0.008).toFixed(3)}</DataList.NumberCell>
          </DataList.RowButton>
        ))}
      </DataList>
    </div>
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
              size="icon-sm"
              tooltip={`Edit ${item.name}`}
              aria-label={`Edit ${item.name}`}
              onClick={event => event.stopPropagation()}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              tooltip={`Delete ${item.name}`}
              aria-label={`Delete ${item.name}`}
              onClick={event => event.stopPropagation()}
            >
              <Trash2 />
            </Button>
          </DataList.ActionsCell>
        </DataList.RowWrapper>
      ))}
    </DataList>
  ),
};

type RunSortKey = 'id' | 'input' | 'status' | 'createdAt';

function sortRuns(runs: SampleRun[], key: RunSortKey, sort: DataListSort) {
  const multiplier = sort === 'asc' ? 1 : -1;
  return [...runs].sort((left, right) => left[key].localeCompare(right[key]) * multiplier);
}

/**
 * Column sorting is opt-in per column via `SortableTopCell`. The parent owns the sort state:
 * `sort` is set only on the active column, and `onSortChange` receives the next sort and the column key.
 */
export const WithSorting: Story = {
  render: function WithSortingStory() {
    const [runSort, setRunSort] = useState<{ key: RunSortKey; value: DataListSort }>({
      key: 'createdAt',
      value: 'desc',
    });
    const handleSort = (value: DataListSort, key: RunSortKey) => setRunSort({ key, value });
    const sortFor = (key: RunSortKey) => (runSort.key === key ? runSort.value : undefined);

    return (
      <DataList columns={COLUMNS}>
        <DataList.Top>
          <DataList.SortableTopCell sortKey="id" sort={sortFor('id')} onSortChange={handleSort}>
            ID
          </DataList.SortableTopCell>
          <DataList.SortableTopCell sortKey="input" sort={sortFor('input')} onSortChange={handleSort}>
            Input
          </DataList.SortableTopCell>
          <DataList.SortableTopCell sortKey="status" sort={sortFor('status')} onSortChange={handleSort}>
            Status
          </DataList.SortableTopCell>
          <DataList.SortableTopCell sortKey="createdAt" sort={sortFor('createdAt')} onSortChange={handleSort}>
            Date
          </DataList.SortableTopCell>
          <DataList.TopCell>Time</DataList.TopCell>
        </DataList.Top>
        {sortRuns(SAMPLE_RUNS, runSort.key, runSort.value).map(run => (
          <DataList.RowButton key={run.id} onClick={() => {}}>
            <RunCells run={run} />
          </DataList.RowButton>
        ))}
      </DataList>
    );
  },
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

export const WithGroups: Story = {
  render: () => (
    <DataList columns={COLUMNS}>
      <RunsHeader />
      <DataList.Group aria-label="Running" className="pb-4">
        <DataList.Subheader>Running</DataList.Subheader>
        {SAMPLE_RUNS.slice(0, 2).map(run => (
          <DataList.RowButton key={run.id} onClick={() => {}}>
            <RunCells run={run} />
          </DataList.RowButton>
        ))}
        <Button variant="ghost" size="sm" className="justify-self-center">
          Load more runs
        </Button>
      </DataList.Group>
      <DataList.Group aria-label="Finished" className="pb-4">
        <DataList.Subheader>Finished</DataList.Subheader>
        <DataList.NoMatch message="Nothing finished yet" />
      </DataList.Group>
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

type CreditStatus = 'issued' | 'pending' | 'expired';

type Credit = {
  id: string;
  type: string;
  amount: string;
  title: string;
  reason: string;
  status: CreditStatus;
  date: string;
  balance: string;
};

const CREDITS: Credit[] = [
  {
    id: 'credit_1',
    type: 'Credit grant',
    amount: '$2.00',
    title: 'Deployed starter agent',
    reason: 'Onboarding reward',
    status: 'issued',
    date: '3h',
    balance: '$6.95',
  },
  {
    id: 'credit_2',
    type: 'Credit grant',
    amount: '$5.00',
    title: 'Verified work email',
    reason: 'Onboarding reward',
    status: 'issued',
    date: '3h',
    balance: '$4.95',
  },
  {
    id: 'credit_3',
    type: 'Top-up',
    amount: '$20.00',
    title: 'Card ending 4242',
    reason: 'Auto top-up',
    status: 'pending',
    date: '1d',
    balance: '$0.00',
  },
  {
    id: 'credit_4',
    type: 'Usage',
    amount: '−$12.40',
    title: 'support-agent',
    reason: 'vCPU and memory, Oct 1 to Oct 7',
    status: 'issued',
    date: '3d',
    balance: '$0.00',
  },
  {
    id: 'credit_5',
    type: 'Credit grant',
    amount: '$10.00',
    title: 'Launch week promotion',
    reason: 'Marketing credit',
    status: 'expired',
    date: 'Sep 12',
    balance: '$12.40',
  },
];

const CREDIT_COLUMNS = 'minmax(8rem,auto) minmax(5rem,auto) minmax(12rem,1fr) minmax(5rem,auto) minmax(4rem,auto) auto';

const CREDIT_STATUS_LABELS = {
  issued: 'Issued',
  pending: 'Pending',
  expired: 'Expired',
} satisfies Record<CreditStatus, string>;

const CREDIT_STATUS_OPTIONS = [
  { value: 'issued', label: CREDIT_STATUS_LABELS.issued },
  { value: 'pending', label: CREDIT_STATUS_LABELS.pending },
  { value: 'expired', label: CREDIT_STATUS_LABELS.expired },
];

const CREDIT_TYPE_OPTIONS = [
  { value: 'Credit grant', label: 'Credit grant' },
  { value: 'Top-up', label: 'Top-up' },
  { value: 'Usage', label: 'Usage' },
];

function matchesCreditSearch(credit: Credit, search: string) {
  const query = search.toLowerCase();
  return [credit.type, credit.title, credit.reason].some(value => value.toLowerCase().includes(query));
}

function matchesCreditStatuses(credit: Credit, statuses: string[]) {
  if (statuses.length === 0) return true;
  return statuses.includes(credit.status);
}

function CreditHeader() {
  return (
    <DataList.Top>
      <DataList.TopCell>Type</DataList.TopCell>
      <DataList.TopCell>Amount</DataList.TopCell>
      <DataList.TopCell>Description</DataList.TopCell>
      <DataList.TopCell>Status</DataList.TopCell>
      <DataList.TopCell>Date</DataList.TopCell>
      <DataList.TopCell align="end">Balance</DataList.TopCell>
    </DataList.Top>
  );
}

function CreditRow({ credit }: { credit: Credit }) {
  return (
    <DataList.RowStatic>
      <DataList.TextCell tone="ink">{credit.type}</DataList.TextCell>
      <DataList.NumberCell align="start" tone="ink">
        {credit.amount}
      </DataList.NumberCell>
      <DataList.StackedCell description={credit.reason}>{credit.title}</DataList.StackedCell>
      <DataList.Cell>
        <Badge size="sm" emphasis="subtle">
          {CREDIT_STATUS_LABELS[credit.status]}
        </Badge>
      </DataList.Cell>
      <DataList.Cell>{credit.date}</DataList.Cell>
      <DataList.NumberCell>{credit.balance}</DataList.NumberCell>
    </DataList.RowStatic>
  );
}

function CreditRows({ credits }: { credits: Credit[] }) {
  if (credits.length === 0) return <DataList.NoMatch message="No credits match your filters" />;
  return credits.map(credit => <CreditRow key={credit.id} credit={credit} />);
}

function CreditHistoryTitle() {
  return (
    <div className="flex items-center justify-between gap-4">
      <Txt as="h2" variant="subheading">
        Credit history
      </Txt>
      <Button variant="ghost" size="sm" icon={<ArrowUpRight />}>
        Open billing portal
      </Button>
    </div>
  );
}

type CreditSearchProps = {
  search: string;
  onSearch: (search: string) => void;
};

function CreditSearch({ search, onSearch }: CreditSearchProps) {
  return <ListSearch label="Search credits" placeholder="Search credits" value={search} onSearch={onSearch} />;
}

type CreditStatusFilterProps = {
  statuses: string[];
  onStatusesChange: (statuses: string[]) => void;
};

function CreditStatusFilter({ statuses, onStatusesChange }: CreditStatusFilterProps) {
  return (
    <Combobox
      aria-label="Filter by status"
      multiple
      options={CREDIT_STATUS_OPTIONS}
      placeholder="Status"
      searchPlaceholder="Search statuses"
      value={statuses}
      onValueChange={onStatusesChange}
      className="w-40"
    />
  );
}

function useCreditSearchAndStatus() {
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const credits = CREDITS.filter(
    credit => matchesCreditSearch(credit, search) && matchesCreditStatuses(credit, statuses),
  );
  return { search, setSearch, statuses, setStatuses, credits };
}

function pxOf(value: string) {
  return Number.parseFloat(value);
}

export const CustomTable: Story = {
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle />
      <DataList columns={CREDIT_COLUMNS} fit="container" size="lg">
        <CreditHeader />
        <CreditRows credits={CREDITS.slice(0, 2)} />
      </DataList>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText('Deployed starter agent').closest<HTMLElement>('.data-list-row');
    if (!row) throw new Error('The stacked cell must render inside a row');
    await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    const balanceHeader = canvas.getByText('Balance').parentElement;
    if (!balanceHeader) throw new Error('The Balance header must render inside a top cell');
    await expect(getComputedStyle(balanceHeader).justifyContent).toBe('flex-end');

    const balance = canvas.getByText('$6.95');
    const amount = canvas.getByText('$2.00');
    const amountStyle = getComputedStyle(amount);
    await expect(getComputedStyle(balance).justifyItems).toBe('end');
    await expect(amountStyle.justifyItems).toBe('start');
    await expect(amountStyle.color).toBe(getComputedStyle(canvas.getByText('Deployed starter agent')).color);

    const reason = canvas.getAllByText('Onboarding reward')[0];
    if (!reason) throw new Error('The stacked cell must render its description');
    await expect(pxOf(getComputedStyle(reason).fontSize)).toBeLessThan(pxOf(amountStyle.fontSize));
  },
};

export const WithToolbar: Story = {
  render: function WithToolbarStory() {
    const { search, setSearch, statuses, setStatuses, credits } = useCreditSearchAndStatus();

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle />
        <DataList
          columns={CREDIT_COLUMNS}
          fit="container"
          size="lg"
          toolbar={
            <DataList.Toolbar>
              <DataList.ToolbarStart>
                <CreditSearch search={search} onSearch={setSearch} />
              </DataList.ToolbarStart>
              <DataList.ToolbarEnd>
                <CreditStatusFilter statuses={statuses} onStatusesChange={setStatuses} />
              </DataList.ToolbarEnd>
            </DataList.Toolbar>
          }
        >
          <CreditHeader />
          <CreditRows credits={credits} />
        </DataList>
      </div>
    );
  },
};

export const WithActionRow: Story = {
  render: function WithActionRowStory() {
    const { search, setSearch, statuses, setStatuses, credits } = useCreditSearchAndStatus();

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle />
        <ActionRow>
          <ActionRow.Start>
            <CreditSearch search={search} onSearch={setSearch} />
          </ActionRow.Start>
          <ActionRow.End>
            <CreditStatusFilter statuses={statuses} onStatusesChange={setStatuses} />
          </ActionRow.End>
        </ActionRow>
        <DataList columns={CREDIT_COLUMNS} fit="container" size="lg">
          <CreditHeader />
          <CreditRows credits={credits} />
        </DataList>
      </div>
    );
  },
};

const CREDIT_FILTER_FIELDS: PropertyFilterField[] = [
  { id: 'type', label: 'Type', kind: 'pick-multi', multi: true, options: CREDIT_TYPE_OPTIONS },
  { id: 'status', label: 'Status', kind: 'pick-multi', multi: true, options: CREDIT_STATUS_OPTIONS },
];

function tokenValues(token: PropertyFilterToken) {
  return Array.isArray(token.value) ? token.value : [token.value];
}

function matchesCreditToken(credit: Credit, token: PropertyFilterToken) {
  const values = tokenValues(token);
  if (values.length === 0) return true;
  if (token.fieldId === 'type') return values.includes(credit.type);
  return values.includes(credit.status);
}

export const WithPropertyFilter: Story = {
  render: function WithPropertyFilterStory() {
    const [search, setSearch] = useState('');
    const [tokens, setTokens] = useState<PropertyFilterToken[]>([]);
    const credits = CREDITS.filter(
      credit => matchesCreditSearch(credit, search) && tokens.every(token => matchesCreditToken(credit, token)),
    );

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle />
        <DataList
          columns={CREDIT_COLUMNS}
          fit="container"
          size="lg"
          toolbar={
            <DataList.Toolbar>
              <DataList.ToolbarStart>
                <CreditSearch search={search} onSearch={setSearch} />
                <PropertyFilterApplied fields={CREDIT_FILTER_FIELDS} tokens={tokens} onTokensChange={setTokens} />
              </DataList.ToolbarStart>
              <DataList.ToolbarEnd>
                <PropertyFilterCreator
                  fields={CREDIT_FILTER_FIELDS}
                  tokens={tokens}
                  onTokensChange={setTokens}
                  label="Filter"
                />
              </DataList.ToolbarEnd>
            </DataList.Toolbar>
          }
        >
          <CreditHeader />
          <CreditRows credits={credits} />
        </DataList>
      </div>
    );
  },
};

export const LargeLoading: Story = {
  render: () => <DataListSkeleton columns={CREDIT_COLUMNS} numberOfRows={3} fit="container" size="lg" />,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Table } from './index';
import { ActionRow } from '@/ds/components/ActionRow';
import { Badge } from '@/ds/components/Badge/Badge';
import { Button } from '@/ds/components/Button/Button';
import { Combobox } from '@/ds/components/Combobox/combobox';
import { Input } from '@/ds/components/Input/input';
import { ListSearch } from '@/ds/components/ListSearch/list-search';
import { PropertyFilterApplied } from '@/ds/components/PropertyFilter/property-filter-applied';
import { PropertyFilterCreator } from '@/ds/components/PropertyFilter/property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { SkeletonText } from '@/ds/components/Skeleton/skeleton-text';
import { Switch } from '@/ds/components/Switch/switch';
import { Txt } from '@/ds/components/Txt/Txt';

const meta: Meta<typeof Table> = {
  title: 'New/Table',
  component: Table,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof Table>;

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

const CREDIT_COLUMN_COUNT = 6;

function matchesCreditSearch(credit: Credit, search: string) {
  const query = search.toLowerCase();
  return [credit.type, credit.title, credit.reason].some(value => value.toLowerCase().includes(query));
}

function matchesCreditStatuses(credit: Credit, statuses: string[]) {
  if (statuses.length === 0) return true;
  return statuses.includes(credit.status);
}

function CreditHistoryTitle({ id }: { id: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Txt as="h2" id={id} variant="subheading">
        Credit history
      </Txt>
      <Button variant="ghost" size="sm" icon={<ArrowUpRight />} render={<a href="#billing-portal" />}>
        Open billing portal
      </Button>
    </div>
  );
}

function CreditHeader() {
  return (
    <Table.Header>
      <Table.Row>
        <Table.Head>Type</Table.Head>
        <Table.Head>Amount</Table.Head>
        <Table.Head className="w-full">Description</Table.Head>
        <Table.Head>Status</Table.Head>
        <Table.Head>Date</Table.Head>
        <Table.Head align="end">Balance</Table.Head>
      </Table.Row>
    </Table.Header>
  );
}

function CreditDescription({ credit }: { credit: Credit }) {
  return (
    <div className="flex flex-col">
      <span>{credit.title}</span>
      <Txt as="span" variant="caption" tone="muted">
        {credit.reason}
      </Txt>
    </div>
  );
}

function CreditRow({ credit }: { credit: Credit }) {
  return (
    <Table.Row>
      <Table.Cell>{credit.type}</Table.Cell>
      <Table.Cell>{credit.amount}</Table.Cell>
      <Table.Cell>
        <CreditDescription credit={credit} />
      </Table.Cell>
      <Table.Cell>
        <Badge size="sm" emphasis="subtle">
          {CREDIT_STATUS_LABELS[credit.status]}
        </Badge>
      </Table.Cell>
      <Table.Cell tone="muted">{credit.date}</Table.Cell>
      <Table.Cell align="end" tone="muted">
        {credit.balance}
      </Table.Cell>
    </Table.Row>
  );
}

function CreditRows({ credits }: { credits: Credit[] }) {
  if (credits.length === 0) {
    return (
      <Table.Row>
        <Table.Cell colSpan={CREDIT_COLUMN_COUNT} align="center" tone="muted">
          No credits match your filters
        </Table.Cell>
      </Table.Row>
    );
  }
  return credits.map(credit => <CreditRow key={credit.id} credit={credit} />);
}

function pxOf(value: string) {
  return Number.parseFloat(value);
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The Credit history table from the billing page: a two-line description cell, a status badge, and a right-aligned balance.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle id="credit-history-default" />
      <Table aria-labelledby="credit-history-default">
        <CreditHeader />
        <Table.Body>
          <CreditRows credits={CREDITS.slice(0, 2)} />
        </Table.Body>
      </Table>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', { name: 'Credit history' });
    await expect(within(table).getAllByRole('columnheader')).toHaveLength(CREDIT_COLUMN_COUNT);

    const row = canvas.getByText('Deployed starter agent').closest('tr');
    if (!row) throw new Error('The description must render inside a row');
    await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);

    const balanceHead = canvas.getByRole('columnheader', { name: 'Balance' });
    await expect(getComputedStyle(balanceHead).textAlign).toBe('right');
    await expect(getComputedStyle(canvas.getByRole('cell', { name: '$6.95' })).textAlign).toBe('right');

    const amount = canvas.getByRole('cell', { name: '$2.00' });
    const date = canvas.getAllByRole('cell', { name: '3h' })[0];
    if (!date) throw new Error('The date cell must render');
    await expect(getComputedStyle(amount).color).not.toBe(getComputedStyle(date).color);
    await expect(getComputedStyle(amount).fontVariantNumeric).toContain('tabular-nums');

    const reason = canvas.getAllByText('Onboarding reward')[0];
    if (!reason) throw new Error('The description must render its secondary line');
    await expect(pxOf(getComputedStyle(reason).fontSize)).toBeLessThan(pxOf(getComputedStyle(amount).fontSize));
  },
};

type CreditSearchProps = {
  search: string;
  onSearch: (search: string) => void;
};

function CreditSearch({ search, onSearch }: CreditSearchProps) {
  return <ListSearch label="Search credits" placeholder="Search credits" value={search} onSearch={onSearch} />;
}

export const WithSearchAndFilter: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'ListSearch and a multi-select Combobox in an ActionRow above the table. The caller filters the rows and renders the empty row when nothing matches.',
      },
    },
  },
  render: function WithSearchAndFilterStory() {
    const [search, setSearch] = useState('');
    const [statuses, setStatuses] = useState<string[]>([]);
    const credits = CREDITS.filter(
      credit => matchesCreditSearch(credit, search) && matchesCreditStatuses(credit, statuses),
    );

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-search" />
        <ActionRow>
          <ActionRow.Start>
            <CreditSearch search={search} onSearch={setSearch} />
          </ActionRow.Start>
          <ActionRow.End>
            <Combobox
              aria-label="Filter by status"
              multiple
              options={CREDIT_STATUS_OPTIONS}
              placeholder="Status"
              searchPlaceholder="Search statuses"
              value={statuses}
              onValueChange={setStatuses}
              className="w-40"
            />
          </ActionRow.End>
        </ActionRow>
        <Table aria-labelledby="credit-history-search">
          <CreditHeader />
          <Table.Body>
            <CreditRows credits={credits} />
          </Table.Body>
        </Table>
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
  parameters: {
    docs: {
      description: {
        story:
          'PropertyFilterCreator adds filters on several fields. PropertyFilterApplied shows them beside the search.',
      },
    },
  },
  render: function WithPropertyFilterStory() {
    const [search, setSearch] = useState('');
    const [tokens, setTokens] = useState<PropertyFilterToken[]>([]);
    const credits = CREDITS.filter(
      credit => matchesCreditSearch(credit, search) && tokens.every(token => matchesCreditToken(credit, token)),
    );

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-property-filter" />
        <ActionRow>
          <ActionRow.Start>
            <CreditSearch search={search} onSearch={setSearch} />
            <PropertyFilterApplied fields={CREDIT_FILTER_FIELDS} tokens={tokens} onTokensChange={setTokens} />
          </ActionRow.Start>
          <ActionRow.End>
            <PropertyFilterCreator
              fields={CREDIT_FILTER_FIELDS}
              tokens={tokens}
              onTokensChange={setTokens}
              label="Filter"
            />
          </ActionRow.End>
        </ActionRow>
        <Table aria-labelledby="credit-history-property-filter">
          <CreditHeader />
          <Table.Body>
            <CreditRows credits={credits} />
          </Table.Body>
        </Table>
      </div>
    );
  },
};

const PROJECTS = [
  { id: 'support-agent', size: 'Serverless', price: 'Free + usage' },
  { id: 'research-workflows', size: 'Small', price: '$50 / month' },
  { id: 'billing-bot', size: 'Medium', price: '$150 / month' },
];

export const LinkedRows: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Table.RowLink makes the whole row a link. The actions button in the last cell keeps its own click.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <Txt as="h2" id="production-projects" variant="subheading">
        Production projects
      </Txt>
      <Table aria-labelledby="production-projects">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-full">Project</Table.Head>
            <Table.Head>Size</Table.Head>
            <Table.Head align="end">Price</Table.Head>
            <Table.Head>
              <span className="sr-only">Actions</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {PROJECTS.map(project => (
            <Table.Row key={project.id}>
              <Table.Cell>
                <Table.RowLink href={`#projects/${project.id}`}>{project.id}</Table.RowLink>
              </Table.Cell>
              <Table.Cell tone="muted">{project.size}</Table.Cell>
              <Table.Cell align="end" tone="muted">
                {project.price}
              </Table.Cell>
              <Table.Cell align="end">
                <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${project.id}`} tooltip="More">
                  <Ellipsis />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'support-agent' });
    const row = link.closest('tr');
    if (!row) throw new Error('The row link must render inside a row');

    row.scrollIntoView({ block: 'center' });
    const rowBounds = row.getBoundingClientRect();
    const hit = canvasElement.ownerDocument.elementFromPoint(rowBounds.left + rowBounds.width / 2, rowBounds.top + 4);
    await expect(hit === link || link.contains(hit)).toBe(true);

    const action = canvas.getByRole('button', { name: 'More actions for support-agent' });
    action.scrollIntoView({ block: 'center' });
    const actionBounds = action.getBoundingClientRect();
    const actionHit = canvasElement.ownerDocument.elementFromPoint(
      actionBounds.left + actionBounds.width / 2,
      actionBounds.top + actionBounds.height / 2,
    );
    await expect(actionHit === action || action.contains(actionHit)).toBe(true);
  },
};

const AGENT_USAGE = [
  {
    agent: 'support-agent',
    note: 'Answers billing and onboarding questions in the help widget, with a handoff to a human after two failed attempts.',
    resources: [
      { name: 'vCPU', used: '18 vCPU-hours', cost: '$1.80' },
      { name: 'Memory', used: '142 GB-hours', cost: '$7.10' },
    ],
  },
  {
    agent: 'research-workflows',
    note: 'Nightly crawl and summary.',
    resources: [
      { name: 'vCPU', used: '6 vCPU-hours', cost: '$0.60' },
      { name: 'Memory', used: '40 GB-hours', cost: '$2.00' },
    ],
  },
];

function AgentBudget({ agent }: { agent: string }) {
  const [budget, setBudget] = useState('25');
  const [paused, setPaused] = useState(false);
  return (
    <div className="flex items-center justify-end gap-3">
      <Input
        aria-label={`Monthly budget for ${agent}`}
        inputMode="decimal"
        size="sm"
        value={budget}
        onChange={event => setBudget(event.target.value)}
        className="w-20"
      />
      <Switch aria-label={`Pause ${agent}`} checked={paused} onCheckedChange={setPaused} />
    </div>
  );
}

export const Composition: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'rowSpan groups resources under each agent, columnDividers draws lines between columns, the notes cell wraps, and the budget and pause controls are editable.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <Txt as="h2" id="agent-usage" variant="subheading">
        Usage by agent
      </Txt>
      <Table columnDividers aria-labelledby="agent-usage">
        <Table.Header>
          <Table.Row>
            <Table.Head>Agent</Table.Head>
            <Table.Head className="w-full">Notes</Table.Head>
            <Table.Head>Resource</Table.Head>
            <Table.Head align="end">Used</Table.Head>
            <Table.Head align="end">Cost</Table.Head>
            <Table.Head align="end">Budget and pause</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {AGENT_USAGE.flatMap(({ agent, note, resources }) =>
            resources.map((resource, index) => (
              <Table.Row key={`${agent}-${resource.name}`}>
                {index === 0 ? (
                  <>
                    <Table.Cell rowSpan={resources.length}>{agent}</Table.Cell>
                    <Table.Cell rowSpan={resources.length} tone="muted">
                      <p className="min-w-64 whitespace-normal">{note}</p>
                    </Table.Cell>
                  </>
                ) : null}
                <Table.Cell>{resource.name}</Table.Cell>
                <Table.Cell align="end" tone="muted">
                  {resource.used}
                </Table.Cell>
                <Table.Cell align="end">{resource.cost}</Table.Cell>
                {index === 0 ? (
                  <Table.Cell rowSpan={resources.length} align="end">
                    <AgentBudget agent={agent} />
                  </Table.Cell>
                ) : null}
              </Table.Row>
            )),
          )}
        </Table.Body>
      </Table>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const agentCell = canvas.getByRole('cell', { name: 'support-agent' });
    await expect(agentCell.getAttribute('rowspan')).toBe('2');
    const memory = canvas.getAllByRole('cell', { name: 'Memory' })[0];
    if (!memory) throw new Error('The grouped Memory row must render');
    await expect(getComputedStyle(memory).borderLeftWidth).toBe('1px');
    await expect(memory.getBoundingClientRect().left).toBeGreaterThan(agentCell.getBoundingClientRect().right);

    const budget = canvas.getByRole('textbox', { name: 'Monthly budget for support-agent' });
    await userEvent.clear(budget);
    await userEvent.type(budget, '40');
    await expect(budget).toHaveValue('40');

    const pause = canvas.getByRole('switch', { name: 'Pause support-agent' });
    await userEvent.click(pause);
    await expect(pause).toHaveAttribute('aria-checked', 'true');

    const note = canvas.getByText(/Answers billing and onboarding/);
    await expect(note.getBoundingClientRect().height).toBeGreaterThan(pxOf(getComputedStyle(note).lineHeight));
  },
};

export const Empty: Story = {
  parameters: {
    docs: { description: { story: 'One cell spans every column and says what is empty. The header stays in place.' } },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle id="credit-history-empty" />
      <Table aria-labelledby="credit-history-empty">
        <CreditHeader />
        <Table.Body>
          <CreditRows credits={[]} />
        </Table.Body>
      </Table>
    </div>
  ),
};

const LOADING_ROW_IDS = ['loading-1', 'loading-2', 'loading-3'];

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The real header renders right away. SkeletonText fills each cell, and aria-busy is set while loading.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle id="credit-history-loading" />
      <Table aria-labelledby="credit-history-loading" aria-busy>
        <CreditHeader />
        <Table.Body>
          {LOADING_ROW_IDS.map(id => (
            <Table.Row key={id}>
              {Array.from({ length: CREDIT_COLUMN_COUNT }, (_, column) => (
                <Table.Cell key={column}>
                  <SkeletonText className="w-16" />
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  ),
};

type SortKey = 'type' | 'balance';
type SortDirection = 'ascending' | 'descending';
type CreditSort = { key: SortKey; direction: SortDirection };

const sortIcons = {
  ascending: ArrowUp,
  descending: ArrowDown,
  none: ArrowUpDown,
};

function balanceOf(credit: Credit) {
  return Number.parseFloat(credit.balance.replace('$', ''));
}

function compareCredits(left: Credit, right: Credit, key: SortKey) {
  if (key === 'balance') return balanceOf(left) - balanceOf(right);
  return left.type.localeCompare(right.type);
}

function sortCredits(credits: Credit[], sort: CreditSort) {
  const multiplier = sort.direction === 'ascending' ? 1 : -1;
  return credits.toSorted((left, right) => compareCredits(left, right, sort.key) * multiplier);
}

function nextSort(current: CreditSort, key: SortKey): CreditSort {
  if (current.key !== key) return { key, direction: 'ascending' };
  return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
}

type SortableHeadProps = {
  label: string;
  sortKey: SortKey;
  sort: CreditSort;
  onSort: (key: SortKey) => void;
  align?: 'start' | 'end';
};

function SortableHead({ label, sortKey, sort, onSort, align }: SortableHeadProps) {
  const direction = sort.key === sortKey ? sort.direction : 'none';
  const SortIcon = sortIcons[direction];
  return (
    <Table.Head align={align} aria-sort={direction}>
      <span className="inline-flex items-center gap-1">
        {label}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Sort by ${label}`}
          tooltip="Sort"
          onClick={() => onSort(sortKey)}
        >
          <SortIcon />
        </Button>
      </span>
    </Table.Head>
  );
}

export const Sorting: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The caller keeps the sort state and sorts the rows. Each sortable head has a sort button and aria-sort.',
      },
    },
  },
  render: function SortingStory() {
    const [sort, setSort] = useState<CreditSort>({ key: 'balance', direction: 'descending' });
    const handleSort = (key: SortKey) => setSort(current => nextSort(current, key));

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-sorting" />
        <Table aria-labelledby="credit-history-sorting">
          <Table.Header>
            <Table.Row>
              <SortableHead label="Type" sortKey="type" sort={sort} onSort={handleSort} />
              <Table.Head>Amount</Table.Head>
              <Table.Head className="w-full">Description</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Date</Table.Head>
              <SortableHead label="Balance" sortKey="balance" sort={sort} onSort={handleSort} align="end" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <CreditRows credits={sortCredits(CREDITS, sort)} />
          </Table.Body>
        </Table>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const balance = canvas.getByRole('columnheader', { name: /Balance/ });
    await expect(balance).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(canvas.getByRole('button', { name: 'Sort by Type' }));
    await expect(canvas.getByRole('columnheader', { name: /Type/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect(balance).toHaveAttribute('aria-sort', 'none');
  },
};

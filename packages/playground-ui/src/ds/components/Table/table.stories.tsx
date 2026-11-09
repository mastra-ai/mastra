import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpRight, Bot, Columns3, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../Badge';
import { Cell, TxtCell, DateTimeCell, EntryCell } from './Cells';
import { Table, Thead, Th, Tbody, Row } from './Table';
import { ActionRow } from '@/ds/components/ActionRow';
import { Button } from '@/ds/components/Button/Button';
import { Combobox } from '@/ds/components/Combobox/combobox';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/ds/components/Drawer/drawer';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { Input } from '@/ds/components/Input/input';
import { ListSearch } from '@/ds/components/ListSearch/list-search';
import { PropertyFilterApplied } from '@/ds/components/PropertyFilter/property-filter-applied';
import { PropertyFilterCreator } from '@/ds/components/PropertyFilter/property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { SkeletonText } from '@/ds/components/Skeleton/skeleton-text';
import { Switch } from '@/ds/components/Switch/switch';
import { Txt } from '@/ds/components/Txt/Txt';
import { formatFullNumber } from '@/lib/cost';
import { cn } from '@/lib/utils';

const meta: Meta<typeof Table> = {
  title: 'DataDisplay/Table',
  component: Table,
  tags: ['!autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'inset'],
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'small'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <div className="w-150">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
          <Th>Created</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Item One</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
            <TxtCell>Jan 14, 2026</TxtCell>
          </Row>
          <Row>
            <TxtCell>Item Two</TxtCell>
            <Cell>
              <Badge>Pending</Badge>
            </Cell>
            <TxtCell>Jan 13, 2026</TxtCell>
          </Row>
          <Row>
            <TxtCell>Item Three</TxtCell>
            <Cell>
              <Badge variant="destructive">Error</Badge>
            </Cell>
            <TxtCell>Jan 12, 2026</TxtCell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const SmallSize: Story = {
  render: () => (
    <div className="w-150">
      <Table size="small">
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Item One</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row>
            <TxtCell>Item Two</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const WithDateTimeCell: Story = {
  render: () => (
    <div className="w-150">
      <Table>
        <Thead>
          <Th>Event</Th>
          <Th>Timestamp</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Agent started</TxtCell>
            <DateTimeCell dateTime={new Date()} />
          </Row>
          <Row>
            <TxtCell>Workflow completed</TxtCell>
            <DateTimeCell dateTime={new Date(Date.now() - 3600000)} />
          </Row>
          <Row>
            <TxtCell>Error logged</TxtCell>
            <DateTimeCell dateTime={new Date(Date.now() - 86400000)} />
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const WithEntryCell: Story = {
  render: () => (
    <div className="w-175">
      <Table>
        <Thead>
          <Th>Agent</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <EntryCell name="Customer Support Agent" description="Handles customer inquiries" icon={<Bot />} />
            <Cell>
              <Badge variant="success">Online</Badge>
            </Cell>
          </Row>
          <Row>
            <EntryCell name="Data Analysis Agent" description="Processes analytics data" icon={<Bot />} />
            <Cell>
              <Badge>Idle</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const ClickableRows: Story = {
  render: () => (
    <div className="w-150">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Type</Th>
        </Thead>
        <Tbody>
          <Row onClick={() => console.log('Row 1 clicked')}>
            <TxtCell>Clickable Row 1</TxtCell>
            <TxtCell>Type A</TxtCell>
          </Row>
          <Row onClick={() => console.log('Row 2 clicked')}>
            <TxtCell>Clickable Row 2</TxtCell>
            <TxtCell>Type B</TxtCell>
          </Row>
          <Row onClick={() => console.log('Row 3 clicked')}>
            <TxtCell>Clickable Row 3</TxtCell>
            <TxtCell>Type C</TxtCell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

export const SelectedRow: Story = {
  render: () => (
    <div className="w-150">
      <Table>
        <Thead>
          <Th>Name</Th>
          <Th>Status</Th>
        </Thead>
        <Tbody>
          <Row>
            <TxtCell>Regular Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row selected>
            <TxtCell>Selected Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
          <Row>
            <TxtCell>Regular Row</TxtCell>
            <Cell>
              <Badge variant="success">Active</Badge>
            </Cell>
          </Row>
        </Tbody>
      </Table>
    </div>
  ),
};

type CreditStatus = 'issued' | 'pending' | 'expired';

type Credit = {
  id: string;
  type: string;
  amount: number;
  title: string;
  reason: string;
  status: CreditStatus;
  date: string;
  balance: number;
};

const CREDITS: Credit[] = [
  {
    id: 'credit_1',
    type: 'Credit grant',
    amount: 2,
    title: 'Deployed starter agent',
    reason: 'Onboarding reward',
    status: 'issued',
    date: '3h',
    balance: 6.95,
  },
  {
    id: 'credit_2',
    type: 'Credit grant',
    amount: 5,
    title: 'Verified work email',
    reason: 'Onboarding reward',
    status: 'issued',
    date: '3h',
    balance: 4.95,
  },
  {
    id: 'credit_3',
    type: 'Top-up',
    amount: 20,
    title: 'Card ending 4242',
    reason: 'Auto top-up',
    status: 'pending',
    date: '1d',
    balance: 0,
  },
  {
    id: 'credit_4',
    type: 'Usage',
    amount: -12.4,
    title: 'support-agent',
    reason: 'vCPU and memory, Oct 1 to Oct 7',
    status: 'issued',
    date: '3d',
    balance: 0,
  },
  {
    id: 'credit_5',
    type: 'Credit grant',
    amount: 10,
    title: 'Launch week promotion',
    reason: 'Marketing credit',
    status: 'expired',
    date: 'Sep 12',
    balance: 12.4,
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

function amountTone(value: number) {
  if (value < 0) return 'muted';
  return 'ink';
}

function formatCreditAmount(value: number) {
  return formatFullNumber(value, { currency: 'USD' });
}

function BillingPortalLink() {
  return (
    <Button variant="link" size="sm" iconEnd={<ArrowUpRight />} render={<a href="#billing-portal" />}>
      Open billing portal
    </Button>
  );
}

function CreditHistoryTitle({ id, withLink = true }: { id: string; withLink?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Txt as="h2" id={id} variant="subheading">
        Credit history
      </Txt>
      {withLink && <BillingPortalLink />}
    </div>
  );
}

function CreditHeader() {
  return (
    <Table.Header>
      <Table.Row>
        <Table.Head>Type</Table.Head>
        <Table.Head align="end">Amount</Table.Head>
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
      <Table.Cell align="end" tone={amountTone(credit.amount)}>
        {formatCreditAmount(credit.amount)}
      </Table.Cell>
      <Table.Cell>
        <CreditDescription credit={credit} />
      </Table.Cell>
      <Table.Cell>
        <Badge size="sm" emphasis="subtle">
          {CREDIT_STATUS_LABELS[credit.status]}
        </Badge>
      </Table.Cell>
      <Table.Cell>{credit.date}</Table.Cell>
      <Table.Cell align="end">{formatCreditAmount(credit.balance)}</Table.Cell>
    </Table.Row>
  );
}

function CreditRows({ credits }: { credits: Credit[] }) {
  if (credits.length === 0) {
    return (
      <Table.Row>
        <Table.Cell colSpan={CREDIT_COLUMN_COUNT} tone="muted">
          No credits match your filters
        </Table.Cell>
      </Table.Row>
    );
  }
  return credits.map(credit => <CreditRow key={credit.id} credit={credit} />);
}

export const Inset: Story = {
  parameters: {
    layout: 'padded',
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
      <Table variant="inset" aria-labelledby="credit-history-default">
        <CreditHeader />
        <Table.Body>
          <CreditRows credits={CREDITS.slice(0, 2)} />
        </Table.Body>
      </Table>
    </div>
  ),
};

type CreditSearchProps = {
  search: string;
  onSearch: (search: string) => void;
};

function CreditSearch({ search, onSearch }: CreditSearchProps) {
  return <ListSearch label="Search credits" placeholder="Search credits" value={search} onSearch={onSearch} />;
}

export const InsetSearchAndFilter: Story = {
  parameters: {
    layout: 'padded',
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
        <CreditHistoryTitle id="credit-history-search" withLink={false} />
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
            <BillingPortalLink />
          </ActionRow.End>
        </ActionRow>
        <Table variant="inset" aria-labelledby="credit-history-search">
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
  if (Array.isArray(token.value)) return token.value;
  return [token.value];
}

function matchesCreditToken(credit: Credit, token: PropertyFilterToken) {
  const values = tokenValues(token);
  if (values.length === 0) return true;
  if (token.fieldId === 'type') return values.includes(credit.type);
  return values.includes(credit.status);
}

export const InsetPropertyFilter: Story = {
  parameters: {
    layout: 'padded',
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
        <CreditHistoryTitle id="credit-history-property-filter" withLink={false} />
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
            <BillingPortalLink />
          </ActionRow.End>
        </ActionRow>
        <Table variant="inset" aria-labelledby="credit-history-property-filter">
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

export const InsetLinkedRows: Story = {
  parameters: {
    layout: 'padded',
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
      <Table variant="inset" aria-labelledby="production-projects">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-full">Project</Table.Head>
            <Table.Head>Size</Table.Head>
            <Table.Head align="end">Price</Table.Head>
            <Table.Head align="end">
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
              <Table.Cell>{project.size}</Table.Cell>
              <Table.Cell align="end">{project.price}</Table.Cell>
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
};

const AGENT_USAGE = [
  {
    agent: 'support-agent',
    note: 'Answers billing and onboarding questions in the help widget, with a handoff to a human after two failed attempts.',
    vcpuHours: 18,
    memoryGbHours: 142,
    cost: 8.9,
  },
  {
    agent: 'research-workflows',
    note: 'Nightly crawl and summary.',
    vcpuHours: 6,
    memoryGbHours: 40,
    cost: 2.6,
  },
];

const hours = new Intl.NumberFormat('en-US');

function AgentBudget({ agent }: { agent: string }) {
  const [budget, setBudget] = useState('25');
  return (
    <Input
      aria-label={`Monthly budget for ${agent}`}
      inputMode="decimal"
      size="sm"
      value={budget}
      onChange={event => setBudget(event.target.value)}
      className="ml-auto w-20 text-end"
    />
  );
}

function AgentPause({ agent }: { agent: string }) {
  const [paused, setPaused] = useState(false);
  return <Switch aria-label={`Pause ${agent}`} checked={paused} onCheckedChange={setPaused} />;
}

export const InsetComposition: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'One row per agent. columnDividers draws lines between columns, the notes cell wraps, numbers are right-aligned, and the budget and pause controls are editable.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <Txt as="h2" id="agent-usage" variant="subheading">
        Usage by agent
      </Txt>
      <Table variant="inset" columnDividers aria-labelledby="agent-usage">
        <Table.Header>
          <Table.Row>
            <Table.Head>Agent</Table.Head>
            <Table.Head className="w-full">Notes</Table.Head>
            <Table.Head align="end">vCPU-hours</Table.Head>
            <Table.Head align="end">Memory GB-hours</Table.Head>
            <Table.Head align="end">Cost</Table.Head>
            <Table.Head align="end">Monthly budget</Table.Head>
            <Table.Head>Paused</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {AGENT_USAGE.map(usage => (
            <Table.Row key={usage.agent}>
              <Table.Cell>{usage.agent}</Table.Cell>
              <Table.Cell>
                <Txt as="p" variant="body-sm" className="min-w-64 whitespace-normal">
                  {usage.note}
                </Txt>
              </Table.Cell>
              <Table.Cell align="end">{hours.format(usage.vcpuHours)}</Table.Cell>
              <Table.Cell align="end">{hours.format(usage.memoryGbHours)}</Table.Cell>
              <Table.Cell align="end">{formatCreditAmount(usage.cost)}</Table.Cell>
              <Table.Cell align="end">
                <AgentBudget agent={usage.agent} />
              </Table.Cell>
              <Table.Cell>
                <AgentPause agent={usage.agent} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  ),
};

export const InsetEmpty: Story = {
  parameters: {
    layout: 'padded',
    docs: { description: { story: 'One cell spans every column and says what is empty. The header stays in place.' } },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle id="credit-history-empty" />
      <Table variant="inset" aria-labelledby="credit-history-empty">
        <CreditHeader />
        <Table.Body>
          <CreditRows credits={[]} />
        </Table.Body>
      </Table>
    </div>
  ),
};

const LOADING_ROW_IDS = ['loading-1', 'loading-2', 'loading-3'];

export const InsetLoading: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'The real header renders right away. SkeletonText fills each cell, and aria-busy is set while loading.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-5xl flex-col gap-3">
      <CreditHistoryTitle id="credit-history-loading" />
      <Table variant="inset" aria-labelledby="credit-history-loading" aria-busy>
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

function compareCredits(left: Credit, right: Credit, key: SortKey) {
  if (key === 'balance') return left.balance - right.balance;
  return left.type.localeCompare(right.type);
}

function sortCredits(credits: Credit[], sort: CreditSort) {
  const ascending = credits.toSorted((left, right) => compareCredits(left, right, sort.key));
  if (sort.direction === 'ascending') return ascending;
  return ascending.toReversed();
}

function sortDirectionFor(sort: CreditSort, key: SortKey) {
  if (sort.key === key) return sort.direction;
  return 'none';
}

function nextSort(current: CreditSort, key: SortKey): CreditSort {
  if (current.key !== key) return { key, direction: 'ascending' };
  if (current.direction === 'ascending') return { key, direction: 'descending' };
  return { key, direction: 'ascending' };
}

type SortableHeadProps = {
  label: string;
  sortKey: SortKey;
  sort: CreditSort;
  onSort: (key: SortKey) => void;
  align?: 'start' | 'end';
};

function SortableHead({ label, sortKey, sort, onSort, align }: SortableHeadProps) {
  const direction = sortDirectionFor(sort, sortKey);
  return (
    <Table.Head align={align} aria-sort={direction}>
      <Table.SortButton direction={direction} onClick={() => onSort(sortKey)}>
        {label}
      </Table.SortButton>
    </Table.Head>
  );
}

export const InsetSorting: Story = {
  parameters: {
    layout: 'padded',
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
        <Table variant="inset" aria-labelledby="credit-history-sorting">
          <Table.Header>
            <Table.Row>
              <SortableHead label="Type" sortKey="type" sort={sort} onSort={handleSort} />
              <Table.Head align="end">Amount</Table.Head>
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
};

const CREDIT_PAGE_SIZE = 2;

export const InsetPagination: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Numbered pagination below the table. The caller owns the page and the rows; search resets to the first page. Two rows per page so every page is reachable here.',
      },
    },
  },
  render: function PaginatedCreditHistory() {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const filteredCredits = CREDITS.filter(credit => matchesCreditSearch(credit, search));
    const offset = page * CREDIT_PAGE_SIZE;
    const pageCredits = filteredCredits.slice(offset, offset + CREDIT_PAGE_SIZE);
    const pageCount = Math.ceil(filteredCredits.length / CREDIT_PAGE_SIZE);

    function changeSearch(value: string) {
      setSearch(value);
      setPage(0);
    }

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-pagination" withLink={false} />
        <ActionRow>
          <ActionRow.Start>
            <ListSearch label="Search credits" placeholder="Search credits" value={search} onSearch={changeSearch} />
          </ActionRow.Start>
          <ActionRow.End>
            <BillingPortalLink />
          </ActionRow.End>
        </ActionRow>
        <Table variant="inset" aria-labelledby="credit-history-pagination">
          <CreditHeader />
          <Table.Body>
            <CreditRows credits={pageCredits} />
          </Table.Body>
        </Table>
        <Table.Pagination aria-label="Credit history pages" page={page} pageCount={pageCount} onPageChange={setPage} />
      </div>
    );
  },
};

const MANY_PAGES = 24;

export const InsetPaginationManyPages: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'With many pages, the first and last pages stay visible and the rest collapse around the current page.',
      },
    },
  },
  render: function ManyPages() {
    const [page, setPage] = useState(5);
    return <Table.Pagination page={page} pageCount={MANY_PAGES} onPageChange={setPage} />;
  },
};

type CreditColumnId = 'type' | 'amount' | 'description' | 'status' | 'date' | 'balance';

type CreditColumn = {
  id: CreditColumnId;
  label: string;
  align?: 'end';
  required?: boolean;
  grow?: boolean;
  cell: (credit: Credit) => ReactNode;
};

const CREDIT_COLUMNS: CreditColumn[] = [
  { id: 'type', label: 'Type', required: true, cell: credit => credit.type },
  {
    id: 'amount',
    label: 'Amount',
    align: 'end',
    cell: credit => formatCreditAmount(credit.amount),
  },
  {
    id: 'description',
    label: 'Description',
    grow: true,
    cell: credit => <CreditDescription credit={credit} />,
  },
  {
    id: 'status',
    label: 'Status',
    cell: credit => (
      <Badge size="sm" emphasis="subtle">
        {CREDIT_STATUS_LABELS[credit.status]}
      </Badge>
    ),
  },
  { id: 'date', label: 'Date', cell: credit => credit.date },
  { id: 'balance', label: 'Balance', align: 'end', cell: credit => formatCreditAmount(credit.balance) },
];

function columnTone(column: CreditColumn, credit: Credit) {
  if (column.id === 'amount') return amountTone(credit.amount);
  return 'ink';
}

export const InsetColumnPicker: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'A Columns menu in the ActionRow shows and hides columns. The caller keeps the visible set; the first column stays on so every row keeps its name.',
      },
    },
  },
  render: function ColumnPickerStory() {
    const [hidden, setHidden] = useState<ReadonlySet<CreditColumnId>>(new Set(['status']));
    const columns = CREDIT_COLUMNS.filter(column => !hidden.has(column.id));

    function toggleColumn(id: CreditColumnId) {
      setHidden(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-columns" withLink={false} />
        <ActionRow>
          <ActionRow.End>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="ghost" size="md" icon={<Columns3 />}>
                    Columns
                  </Button>
                }
              />
              <DropdownMenu.Content align="end" className="min-w-48">
                <DropdownMenu.Label>Show columns</DropdownMenu.Label>
                {CREDIT_COLUMNS.map(column => (
                  <DropdownMenu.CheckboxItem
                    key={column.id}
                    checked={!hidden.has(column.id)}
                    disabled={column.required}
                    onCheckedChange={() => toggleColumn(column.id)}
                  >
                    {column.label}
                  </DropdownMenu.CheckboxItem>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
            <BillingPortalLink />
          </ActionRow.End>
        </ActionRow>
        <Table variant="inset" aria-labelledby="credit-history-columns">
          <Table.Header>
            <Table.Row>
              {columns.map(column => (
                <Table.Head key={column.id} align={column.align} className={cn(column.grow && 'w-full')}>
                  {column.label}
                </Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {CREDITS.map(credit => (
              <Table.Row key={credit.id}>
                {columns.map(column => (
                  <Table.Cell key={column.id} align={column.align} tone={columnTone(column, credit)}>
                    {column.cell(credit)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  },
};

function CreditDetail({ credit }: { credit: Credit }) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{credit.title}</DrawerTitle>
        <DrawerDescription>{credit.reason}</DrawerDescription>
      </DrawerHeader>
      <DrawerBody>
        <Txt variant="body-sm">
          {credit.type}, {formatCreditAmount(credit.amount)}, {credit.date}
        </Txt>
      </DrawerBody>
    </>
  );
}

export const InsetRowButtons: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Table.RowButton makes the whole row clickable for an action that is not navigation, here opening a drawer. Use Table.RowLink when the row goes to another page.',
      },
    },
  },
  render: function RowButtonsStory() {
    const [selected, setSelected] = useState<Credit | undefined>(undefined);

    return (
      <div className="flex max-w-5xl flex-col gap-3">
        <CreditHistoryTitle id="credit-history-row-buttons" />
        <Table variant="inset" aria-labelledby="credit-history-row-buttons">
          <CreditHeader />
          <Table.Body>
            {CREDITS.map(credit => (
              <Table.Row key={credit.id}>
                <Table.Cell>
                  <Table.RowButton onClick={() => setSelected(credit)}>{credit.type}</Table.RowButton>
                </Table.Cell>
                <Table.Cell align="end" tone={amountTone(credit.amount)}>
                  {formatCreditAmount(credit.amount)}
                </Table.Cell>
                <Table.Cell>
                  <CreditDescription credit={credit} />
                </Table.Cell>
                <Table.Cell>
                  <Badge size="sm" emphasis="subtle">
                    {CREDIT_STATUS_LABELS[credit.status]}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{credit.date}</Table.Cell>
                <Table.Cell align="end">{formatCreditAmount(credit.balance)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <Drawer side="right" open={selected !== undefined} onOpenChange={open => !open && setSelected(undefined)}>
          <DrawerContent>{selected && <CreditDetail credit={selected} />}</DrawerContent>
        </Drawer>
      </div>
    );
  },
};

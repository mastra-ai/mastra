import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BoxIcon,
  Columns2Icon,
  Columns3Icon,
  EllipsisVerticalIcon,
  FolderIcon,
  GlobeIcon,
  ListFilterPlusIcon,
  ListIcon,
  NetworkIcon,
  TagIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { traceFilterFieldColor } from '@/domains/traces/trace-filters';
import { ActionRow } from '@/ds/components/ActionRow';
import { Button, TriggerChevron } from '@/ds/components/Button/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { ClearFiltersButton } from '@/ds/components/ClearFiltersButton';
import { ComboboxContent, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger } from '@/ds/components/Combobox';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker';
import type { DateRangePreset } from '@/ds/components/DateTimeRangePicker';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { FilterBar } from '@/ds/components/FilterBar';
import { DEFAULT_FILTER_OPERATORS } from '@/ds/components/FilterBar/default-operators';
import {
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
} from '@/ds/components/FilterBar/filter-bar-time-range';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar/types';
import { ListSearch } from '@/ds/components/ListSearch';
import { SearchInput } from '@/ds/components/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';

/*
 * Every page toolbar in Studio and Platform, rebuilt from the same components and props as
 * the page (file:line under each). A review page, not documentation: run it on two branches to
 * compare.
 */

const meta: Meta = {
  title: 'Composite/Toolbar audit',
  parameters: { layout: 'fullscreen' },
};
export default meta;

const FIELDS: FilterBarField[] = [
  FILTER_BAR_TIME_RANGE_FIELD,
  {
    id: 'environment',
    label: 'Environment',
    icon: GlobeIcon,
    operators: ['is', 'is-not'],
    suggestions: [],
    color: traceFilterFieldColor('environment'),
  },
  {
    id: 'rootEntityType',
    label: 'Primitive type',
    icon: BoxIcon,
    operators: ['is'],
    suggestions: [],
    color: traceFilterFieldColor('rootEntityType'),
  },
  {
    id: 'project',
    label: 'Project',
    icon: FolderIcon,
    operators: ['is'],
    suggestions: [],
    color: traceFilterFieldColor('project'),
  },
  { id: 'tag', label: 'Tag', icon: TagIcon, operators: ['is'], suggestions: [], color: traceFilterFieldColor('tag') },
];

const ENVIRONMENT: FilterBarItem = { id: 'environment', fieldId: 'environment', operatorId: 'is', value: 'production' };
const PRIMITIVE: FilterBarItem = { id: 'rootEntityType', fieldId: 'rootEntityType', operatorId: 'is', value: 'Agent' };
const PROJECT: FilterBarItem = { id: 'project', fieldId: 'project', operatorId: 'is', value: 'Demo Agents' };

const CUSTOM_FROM = new Date('2026-10-27T00:00:00');
const CUSTOM_TO = new Date('2026-10-29T00:00:00');

function useRangeFixture(initial: DateRangePreset) {
  const [preset, setPreset] = useState<DateRangePreset>(initial);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({ from: CUSTOM_FROM, to: CUSTOM_TO });
  return {
    preset,
    onPresetChange: setPreset,
    dateFrom: preset === 'custom' ? range.from : undefined,
    dateTo: preset === 'custom' ? range.to : undefined,
    onDateRangeChange: (from: Date | undefined, to: Date | undefined) => setRange({ from, to }),
    // Presets and the × reset clear the range one end at a time.
    onDateChange: (date: Date | undefined, side: 'from' | 'to') => setRange(current => ({ ...current, [side]: date })),
  };
}

function TimeRange({ initial, withReset }: { initial: DateRangePreset; withReset?: boolean }) {
  return <FilterBar.TimeRange {...useRangeFixture(initial)} defaultPreset={withReset ? 'last-7d' : undefined} />;
}

/** A FilterBar whose time item renders the time range; everything else is a regular chip. */
function Bar({
  items: initialItems,
  timeRange,
  placeholder,
  leading,
}: {
  items: FilterBarItem[];
  timeRange?: ReactNode;
  placeholder: string;
  leading?: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  return (
    <FilterBar
      fields={FIELDS}
      operators={DEFAULT_FILTER_OPERATORS}
      value={items}
      onValueChange={setItems}
      className="min-w-64 flex-1"
    >
      {leading}
      <FilterBar.Chips renderChip={item => (isTime(item) ? timeRange : <FilterBar.Chip item={item} />)} />
      <FilterBar.Input placeholder={placeholder} />
    </FilterBar>
  );
}

const isTime = (item: FilterBarItem) => item.fieldId === FILTER_BAR_TIME_RANGE_FIELD_ID;

function ColumnsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger size="icon-sm" tooltip="Columns">
        <Columns3Icon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Item>Start</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function SourceSelect() {
  return (
    <Select defaultValue="all">
      <SelectTrigger aria-label="Source" size="sm" className="w-auto whitespace-nowrap">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sources</SelectItem>
        <SelectItem value="code">Code</SelectItem>
        <SelectItem value="stored">Stored</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Platform gateway/query MetricCombobox (QueryControls.tsx:68), on the DS trigger's icon and chevron. */
function GatewayMetric() {
  return (
    <ComboboxRoot items={['Spend', 'Requests', 'Tokens']} defaultValue="Spend">
      <ComboboxTrigger size="sm" icon={<NetworkIcon />} aria-label="Metric" className="w-auto">
        <span className="text-muted-foreground">Gateway</span> Spend
      </ComboboxTrigger>
      <ComboboxContent align="start">
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

/** Platform GroupByMenu (QueryControls.tsx:117): muted prefix, the Button's own chevron slot. */
function GroupByMenu() {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button size="sm" iconEnd={<TriggerChevron />}>
            <span className="text-muted-foreground">By</span> Model
          </Button>
        }
      />
      <DropdownMenu.Content align="start">
        <DropdownMenu.Item>Model</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function StandalonePicker() {
  return <DateTimeRangePicker {...useRangeFixture('last-24h')} />;
}

function Case({ name, source, children }: { name: string; source: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-b border-border py-5">
      <div className="flex items-baseline gap-3">
        <Txt variant="label">{name}</Txt>
        <Txt variant="caption" tone="muted" font="mono">
          {source}
        </Txt>
      </div>
      {children}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid">
      <Txt variant="heading" className="pt-6">
        {title}
      </Txt>
      {children}
    </div>
  );
}

export const AllToolbars: StoryObj = {
  render: () => (
    <div className="bg-surface1 min-h-screen px-8 pb-16">
      <Group title="Studio">
        <Case name="Traces, custom range" source="traces-page-content.tsx:15">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM, ENVIRONMENT, PRIMITIVE]}
                timeRange={<TimeRange initial="custom" withReset />}
                placeholder="Filter traces…"
              />
            </ActionRow.Start>
            <ActionRow.End>
              <ColumnsMenu />
            </ActionRow.End>
          </ActionRow>
        </Case>
        <Case name="Traces, preset" source="traces-page-content.tsx:15">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM]}
                timeRange={<TimeRange initial="last-7d" withReset />}
                placeholder="Filter traces…"
              />
            </ActionRow.Start>
            <ActionRow.End>
              <ColumnsMenu />
            </ActionRow.End>
          </ActionRow>
        </Case>
        <Case name="Metrics" source="metrics-filter-bar.tsx:27">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM]}
                timeRange={<TimeRange initial="last-24h" />}
                placeholder="Filter metrics…"
              />
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Logs" source="pages/logs/index.tsx:143">
          <ActionRow>
            <ActionRow.Start>
              <StandalonePicker />
              <Button size="sm" icon={<ListFilterPlusIcon />}>
                Add filter
              </Button>
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Datasets" source="datasets-filter-bar.tsx:105">
          <ActionRow>
            <ActionRow.Start>
              <Bar items={[]} placeholder="Filter datasets…" />
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Agents" source="pages/agents/index.tsx:91">
          <ActionRow>
            <ActionRow.Start>
              <div className="max-w-120 flex-1">
                <ListSearch onSearch={() => {}} label="Filter agents" placeholder="Filter by name or instructions" />
              </div>
            </ActionRow.Start>
            <ActionRow.End>
              <ButtonsGroup size="sm">
                <Button size="icon-sm" variant="default" aria-label="List view">
                  <ListIcon />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Columns view">
                  <Columns2Icon />
                </Button>
              </ButtonsGroup>
            </ActionRow.End>
          </ActionRow>
        </Case>
        <Case name="Scorers, filtered" source="scorers-toolbar.tsx:36">
          <ActionRow>
            <ActionRow.Start>
              <div className="max-w-120 flex-1">
                <ListSearch onSearch={() => {}} label="Search scorers" placeholder="Filter by scorer name" />
              </div>
              <SourceSelect />
              <ClearFiltersButton onClick={() => {}} />
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Templates" source="templates-tools.tsx:49">
          <div className="flex flex-wrap gap-1.5">
            <SearchInput
              label="Search templates"
              placeholder="Search templates"
              size="sm"
              value=""
              onValueChange={() => {}}
            />
            <SourceSelect />
            <SourceSelect />
            <ClearFiltersButton onClick={() => {}} />
          </div>
        </Case>
      </Group>

      <Group title="Platform">
        <Case name="Gateway query" source="GatewayQuery.tsx:70, QueryControls.tsx:172">
          <ActionRow>
            <ActionRow.Start className="min-w-0 flex-1">
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM]}
                timeRange={<TimeRange initial="last-7d" />}
                placeholder="Filter…"
                leading={
                  <div className="flex items-center gap-1.5">
                    <GatewayMetric />
                    <GroupByMenu />
                  </div>
                }
              />
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Gateway overview" source="GatewayDashboard.tsx:32">
          <div className="flex items-center gap-1.5">
            <StandalonePicker />
            <GroupByMenu />
          </div>
        </Case>
        <Case name="Observe logs" source="ObserveLogsPage.tsx:198">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM, PROJECT]}
                timeRange={<TimeRange initial="last-24h" />}
                placeholder="Filter logs…"
              />
            </ActionRow.Start>
            <ActionRow.End>
              <Button size="icon-sm" aria-label="Filter actions">
                <EllipsisVerticalIcon />
              </Button>
            </ActionRow.End>
          </ActionRow>
        </Case>
        <Case name="Observe traces" source="TracesActionRow.tsx:22">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM, PROJECT]}
                timeRange={<TimeRange initial="last-24h" withReset />}
                placeholder="Filter traces…"
              />
            </ActionRow.Start>
            <ActionRow.End>
              <ColumnsMenu />
            </ActionRow.End>
          </ActionRow>
        </Case>
        <Case name="Edge requests" source="ObserveEdgeRequestsPage.tsx:337">
          <ActionRow>
            <ActionRow.Start>
              <Bar
                items={[FILTER_BAR_TIME_RANGE_ITEM]}
                timeRange={<TimeRange initial="last-24h" />}
                placeholder="Filter requests"
              />
            </ActionRow.Start>
          </ActionRow>
        </Case>
        <Case name="Projects" source="SearchSortBar.tsx:36">
          <div className="flex items-center gap-1.5">
            <SearchInput
              label="Search projects"
              placeholder="Search projects…"
              size="sm"
              value=""
              onValueChange={() => {}}
            />
            <SourceSelect />
          </div>
        </Case>
      </Group>

      <Group title="Search icon inset">
        <Case name="FilterBar input vs SearchInput" source="filter-bar-input.tsx:347, search-input.tsx:45">
          <div className="flex items-center gap-2">
            <Bar items={[]} placeholder="Filter datasets…" />
            <SearchInput label="Search" placeholder="Search…" value="" onValueChange={() => {}} size="sm" />
          </div>
        </Case>
      </Group>
    </div>
  ),
};

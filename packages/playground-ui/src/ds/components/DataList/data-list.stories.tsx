import type { Meta, StoryObj } from '@storybook/react-vite';
import { Columns3Icon, Pencil, Trash2 } from 'lucide-react';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { DataList } from './data-list';
import type { DataListStickyHeaderBackground, DataListVariant } from './data-list-root';
import { DataListSkeleton } from './data-list-skeleton';
import { ScoresDataList } from './ScoresDataList/scores-data-list';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { LinkComponent } from '@/ds/types/link-component';

type DataListStoryArgs = {
  variant: DataListVariant;
  stickyHeaderBackground: DataListStickyHeaderBackground;
};

const VARIANT_OPTIONS: DataListVariant[] = ['lined', 'striped'];
const STICKY_HEADER_BACKGROUND_OPTIONS: DataListStickyHeaderBackground[] = ['tinted', 'surface', 'transparent'];

const meta: Meta<DataListStoryArgs> = {
  title: 'DataDisplay/DataList',
  parameters: {
    layout: 'padded',
  },
  args: {
    variant: 'lined',
    stickyHeaderBackground: 'tinted',
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: VARIANT_OPTIONS,
    },
    stickyHeaderBackground: {
      control: 'inline-radio',
      options: STICKY_HEADER_BACKGROUND_OPTIONS,
    },
  },
};

export default meta;
type Story = StoryObj<DataListStoryArgs>;

/* Sample data — looks like a list of recent agent runs. */
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

const COMPACT_COLUMNS = 'auto minmax(0,1fr) auto auto auto';
const DEFAULT_COLUMNS = 'minmax(0,1fr) minmax(0,2fr) auto';
const WIDE_COLUMNS =
  'minmax(12rem,14rem) minmax(18rem,24rem) minmax(16rem,20rem) minmax(10rem,12rem) minmax(12rem,14rem) minmax(9rem,11rem) minmax(12rem,14rem) minmax(11rem,13rem) minmax(10rem,12rem) minmax(12rem,14rem)';
const VERY_LONG_BADGE =
  'production-critical-evaluation-run-with-an-extraordinarily-long-status-label-that-must-truncate-inside-the-cell';
const MODEL_TOKEN_PLACEHOLDERS = ['__GATEWAY_OPENAI_MODEL_BASE__', '__GATEWAY_ANTHROPIC_MODEL_SONNET__'];

/** The standard condensed look used by Traces, Logs, Scores, Dataset Items, and Skills. */
export const Compact: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      {SAMPLE_RUNS.map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <DataList.IdCell id={run.id} />
          <DataList.MonoCell>{run.input}</DataList.MonoCell>
          <DataList.Cell height="compact">{run.status}</DataList.Cell>
          <DataList.DateCell timestamp={run.createdAt} />
          <DataList.TimeCell timestamp={run.createdAt} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** Taller rows — better for prose-heavy content where each row needs more breathing room. */
export const Default: Story = {
  render: ({ variant }) => (
    <DataList columns={DEFAULT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>Name</DataList.TopCell>
        <DataList.TopCell>Description</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
      </DataList.Top>
      {[
        { name: 'Research Agent', description: 'Reads articles and produces summaries.', status: 'active' },
        { name: 'Writing Agent', description: '', status: 'active' },
        {
          name: 'Answer Relevancy Scorer With A Very Long Display Name That Must Truncate',
          description: 'Evaluates whether generated answers stay aligned with the retrieved evidence.',
          status: 'active',
        },
        { name: 'Translation Agent', description: 'Translates text between supported languages.', status: 'idle' },
      ].map(item => (
        <DataList.RowButton key={item.name} onClick={() => {}}>
          <DataList.NameCell className="font-medium">
            <span className="flex items-center">{item.name}</span>
          </DataList.NameCell>
          <DataList.DescriptionCell>{item.description}</DataList.DescriptionCell>
          <DataList.Cell>{item.status}</DataList.Cell>
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/**
 * Per-row `variant="error"` lays a subtle, theme-aware destructive tint over the
 * row. Use the `variant` control to compare it with each list treatment.
 */
export const WithErrorRows: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant} className="max-h-80">
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      {Array.from({ length: 10 }, (_, index) => {
        const run = SAMPLE_RUNS[index % SAMPLE_RUNS.length];
        if (!run) return null;
        const failed = run.status === 'failed';
        return (
          <DataList.RowButton key={`${run.id}-${index}`} onClick={() => {}} variant={failed ? 'error' : 'default'}>
            <DataList.IdCell id={`${run.id}_${index}`} />
            <DataList.MonoCell>{run.input}</DataList.MonoCell>
            <DataList.Cell height="compact">{run.status}</DataList.Cell>
            <DataList.DateCell timestamp={run.createdAt} />
            <DataList.TimeCell timestamp={run.createdAt} />
          </DataList.RowButton>
        );
      })}
    </DataList>
  ),
};

/* Anchor that ignores navigation so RowLink can render in Storybook. */
const StoryLink: LinkComponent = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ children, href, onClick, ...rest }, ref) => (
    <a
      ref={ref}
      href={href}
      onClick={e => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
);
StoryLink.displayName = 'StoryLink';

/** Use `RowLink` when each row should navigate to a detail page (preserves middle-click + open-in-new-tab). */
export const WithRowLink: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      {SAMPLE_RUNS.map(run => (
        <DataList.RowLink key={run.id} to={`/runs/${run.id}`} LinkComponent={StoryLink}>
          <DataList.IdCell id={run.id} />
          <DataList.MonoCell>{run.input}</DataList.MonoCell>
          <DataList.Cell height="compact">{run.status}</DataList.Cell>
          <DataList.DateCell timestamp={run.createdAt} />
          <DataList.TimeCell timestamp={run.createdAt} />
        </DataList.RowLink>
      ))}
    </DataList>
  ),
};

/** Multi-select with a leading checkbox column. Click the header checkbox to toggle all rows. */
export const WithSelection: Story = {
  render: function WithSelectionStory({ variant }) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const allIds = SAMPLE_RUNS.map(r => r.id);
    const allSelected = selected.size === allIds.length;
    const someSelected = selected.size > 0 && !allSelected;

    const toggle = (id: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const toggleAll = () => {
      setSelected(allSelected ? new Set() : new Set(allIds));
    };

    return (
      <DataList columns={`auto ${COMPACT_COLUMNS}`} variant={variant}>
        <DataList.Top hasLeadingCell>
          <DataList.TopSelectCell
            checked={someSelected ? 'indeterminate' : allSelected}
            onToggle={toggleAll}
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
            <DataList.RowButton flushLeft colStart={2} onClick={() => toggle(run.id)}>
              <DataList.IdCell id={run.id} />
              <DataList.MonoCell>{run.input}</DataList.MonoCell>
              <DataList.Cell height="compact">{run.status}</DataList.Cell>
              <DataList.DateCell timestamp={run.createdAt} />
              <DataList.TimeCell timestamp={run.createdAt} />
            </DataList.RowButton>
          </DataList.RowWrapper>
        ))}
      </DataList>
    );
  },
};

/** Trailing actions column: the row click area is bounded by `colEnd={-2}` + `flushRight`, and the last cell hosts per-row controls. */
export const WithTrailingCell: Story = {
  render: ({ variant }) => (
    <DataList columns="minmax(8rem,auto) minmax(8rem,1fr) minmax(0,2fr) auto" variant={variant}>
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
          <DataList.RowButton flushLeft flushRight colEnd={-2} onClick={() => {}}>
            <DataList.Cell className="text-neutral6 font-medium">{item.name}</DataList.Cell>
            <DataList.MonoCell height="default">{item.path}</DataList.MonoCell>
            <DataList.Cell className="min-w-0">
              <span className="block truncate">{item.description}</span>
            </DataList.Cell>
          </DataList.RowButton>
          <DataList.Cell className="py-0">
            <div className="flex w-full items-center justify-end gap-1 pr-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                tooltip={`Edit ${item.name}`}
                aria-label={`Edit ${item.name}`}
                onClick={e => e.stopPropagation()}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                tooltip={`Delete ${item.name}`}
                aria-label={`Delete ${item.name}`}
                onClick={e => e.stopPropagation()}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </DataList.Cell>
        </DataList.RowWrapper>
      ))}
    </DataList>
  ),
};

/** Use `featured` to highlight the row whose detail panel is currently open. */
export const Featured: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      {SAMPLE_RUNS.map((run, idx) => (
        <DataList.RowButton key={run.id} featured={idx === 1} onClick={() => {}}>
          <DataList.IdCell id={run.id} />
          <DataList.MonoCell>{run.input}</DataList.MonoCell>
          <DataList.Cell height="compact">{run.status}</DataList.Cell>
          <DataList.DateCell timestamp={run.createdAt} />
          <DataList.TimeCell timestamp={run.createdAt} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** `DateCell` shows `Today` or `MMM dd`; `TimeCell` shows `HH:mm:ss.SSS` with monospaced glyphs. */
export const WithDateAndTimeCells: Story = {
  render: ({ variant }) => (
    <DataList columns="auto auto auto" variant={variant}>
      <DataList.Top>
        <DataList.TopCell>Event</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      {[
        { event: 'workflow.started', timestamp: '2026-01-01T00:00:00.000Z' },
        { event: 'tool.call', timestamp: '2026-05-19T14:08:42.317Z' },
        { event: 'workflow.completed', timestamp: '2025-12-03T09:00:00.000Z' },
      ].map(row => (
        <DataList.RowButton key={row.event + row.timestamp} onClick={() => {}}>
          <DataList.MonoCell>{row.event}</DataList.MonoCell>
          <DataList.DateCell timestamp={row.timestamp} />
          <DataList.TimeCell timestamp={row.timestamp} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

/** Empty / no-match state — usually shown when a search filter yields zero rows. */
export const Empty: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>
      <DataList.NoMatch message="No runs match your search" />
    </DataList>
  ),
};

/** Wide grid with constrained columns, horizontal scrolling, and a long badge that must stay inside its cell. */
export const WideColumnsOverflow: Story = {
  render: ({ variant }) => (
    <div className="max-w-190">
      <DataList columns={WIDE_COLUMNS} variant={variant} className="max-h-90">
        <DataList.Top>
          <DataList.TopCell>Run</DataList.TopCell>
          <DataList.TopCell>Input</DataList.TopCell>
          <DataList.TopCell>Status badge</DataList.TopCell>
          <DataList.TopCell>Model</DataList.TopCell>
          <DataList.TopCell>Workflow</DataList.TopCell>
          <DataList.TopCell>Owner</DataList.TopCell>
          <DataList.TopCell>Environment</DataList.TopCell>
          <DataList.TopCell>Duration</DataList.TopCell>
          <DataList.TopCell>Date</DataList.TopCell>
          <DataList.TopCell>Trace</DataList.TopCell>
        </DataList.Top>
        {Array.from({ length: 14 }, (_, index) => {
          const run = SAMPLE_RUNS[index % SAMPLE_RUNS.length];
          if (!run) return null;
          return (
            <DataList.RowButton key={`${run.id}-${index}`} onClick={() => {}}>
              <DataList.IdCell id={`${run.id}_${index}`} />
              <DataList.MonoCell>
                {run.input} with enough extra context to verify truncation in a narrow scrolling grid
              </DataList.MonoCell>
              <DataList.Cell height="compact" className="min-w-0">
                <Badge variant={index % 3 === 0 ? 'warning' : 'success'} className="max-w-full min-w-0 overflow-hidden">
                  <span className="min-w-0 truncate">{index === 2 ? VERY_LONG_BADGE : run.status}</span>
                </Badge>
              </DataList.Cell>
              <DataList.MonoCell>{MODEL_TOKEN_PLACEHOLDERS[index % MODEL_TOKEN_PLACEHOLDERS.length]}</DataList.MonoCell>
              <DataList.MonoCell>daily-evaluation-pipeline-{index + 1}</DataList.MonoCell>
              <DataList.Cell height="compact">Team {index % 5}</DataList.Cell>
              <DataList.Cell height="compact">{index % 2 === 0 ? 'production' : 'staging'}</DataList.Cell>
              <DataList.Cell height="compact">{120 + index * 37}ms</DataList.Cell>
              <DataList.DateCell timestamp={run.createdAt} />
              <DataList.MonoCell>trace_{String(index + 1).padStart(4, '0')}</DataList.MonoCell>
            </DataList.RowButton>
          );
        })}
      </DataList>
    </div>
  ),
};

/** Sticky row headers keep the first column visible while wide metric-like grids scroll horizontally. */
export const StickyRowHeaders: Story = {
  render: ({ variant, stickyHeaderBackground }) => (
    <div className="max-w-190">
      <DataList
        columns="minmax(12rem,auto) auto auto auto auto auto auto auto"
        variant={variant}
        stickyHeaderBackground={stickyHeaderBackground}
        mask={{ left: false }}
        className="max-h-80"
      >
        <DataList.Top>
          <DataList.TopCell sticky="start">Model</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Input</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Output</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cache read</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cache write</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Latency</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Runs</DataList.TopCell>
          <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
        </DataList.Top>
        {Array.from({ length: 12 }, (_, index) => {
          const model = MODEL_TOKEN_PLACEHOLDERS[index % MODEL_TOKEN_PLACEHOLDERS.length];
          return (
            <DataList.RowButton key={`${model}-${index}`} onClick={() => {}}>
              <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                {model}
              </DataList.RowHeaderCell>
              <DataList.NumberCell>{(index * 1300 + 6200).toLocaleString()}</DataList.NumberCell>
              <DataList.NumberCell>{(index * 840 + 2100).toLocaleString()}</DataList.NumberCell>
              <DataList.NumberCell>{(index * 260 + 900).toLocaleString()}</DataList.NumberCell>
              <DataList.NumberCell>{(index * 120 + 300).toLocaleString()}</DataList.NumberCell>
              <DataList.NumberCell>{180 + index * 24}ms</DataList.NumberCell>
              <DataList.NumberCell>{(index + 1) * 17}</DataList.NumberCell>
              <DataList.NumberCell highlight>${(index * 0.014 + 0.008).toFixed(3)}</DataList.NumberCell>
            </DataList.RowButton>
          );
        })}
      </DataList>
    </div>
  ),
};

/** Loading placeholder for any column layout. Pass the same `columns` string the real list uses. */
export const Loading: Story = {
  parameters: {
    controls: {
      exclude: ['variant'],
    },
  },
  render: () => <DataListSkeleton columns={COMPACT_COLUMNS} numberOfRows={5} />,
};

/** Page-based pagination footer — `Previous` shows when `currentPage > 0`, `Next` shows when `hasMore`.
 *  `currentPage` is zero-based: the footer renders it as `currentPage + 1`, so page `0` reads as "Page 1". */
export const WithPagination: Story = {
  render: function WithPaginationStory({ variant }) {
    const [page, setPage] = useState(0);
    return (
      <DataList columns={COMPACT_COLUMNS} variant={variant}>
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Input</DataList.TopCell>
          <DataList.TopCell>Status</DataList.TopCell>
          <DataList.TopCell>Date</DataList.TopCell>
          <DataList.TopCell>Time</DataList.TopCell>
        </DataList.Top>
        {SAMPLE_RUNS.map(run => (
          <DataList.RowButton key={run.id} onClick={() => {}}>
            <DataList.IdCell id={run.id} />
            <DataList.MonoCell>{run.input}</DataList.MonoCell>
            <DataList.Cell height="compact">{run.status}</DataList.Cell>
            <DataList.DateCell timestamp={run.createdAt} />
            <DataList.TimeCell timestamp={run.createdAt} />
          </DataList.RowButton>
        ))}
        <DataList.Pagination
          currentPage={page}
          hasMore={page < 3}
          onNextPage={() => setPage(p => p + 1)}
          onPrevPage={() => setPage(p => Math.max(0, p - 1))}
        />
      </DataList>
    );
  },
};

/** Group rows under labelled sections using `Subheader` (and an optional `SubHeading` for a quieter sub-label). */
export const WithSubheader: Story = {
  render: ({ variant }) => (
    <DataList columns={COMPACT_COLUMNS} variant={variant}>
      <DataList.Top>
        <DataList.TopCell>ID</DataList.TopCell>
        <DataList.TopCell>Input</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
        <DataList.TopCell>Time</DataList.TopCell>
      </DataList.Top>

      <DataList.Subheader>
        Today <DataList.SubHeading>· 2 runs</DataList.SubHeading>
      </DataList.Subheader>
      {SAMPLE_RUNS.slice(0, 2).map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <DataList.IdCell id={run.id} />
          <DataList.MonoCell>{run.input}</DataList.MonoCell>
          <DataList.Cell height="compact">{run.status}</DataList.Cell>
          <DataList.DateCell timestamp={run.createdAt} />
          <DataList.TimeCell timestamp={run.createdAt} />
        </DataList.RowButton>
      ))}

      <DataList.Subheader>
        Yesterday <DataList.SubHeading>· 2 runs</DataList.SubHeading>
      </DataList.Subheader>
      {SAMPLE_RUNS.slice(2).map(run => (
        <DataList.RowButton key={run.id} onClick={() => {}}>
          <DataList.IdCell id={run.id} />
          <DataList.MonoCell>{run.input}</DataList.MonoCell>
          <DataList.Cell height="compact">{run.status}</DataList.Cell>
          <DataList.DateCell timestamp={run.createdAt} />
          <DataList.TimeCell timestamp={run.createdAt} />
        </DataList.RowButton>
      ))}
    </DataList>
  ),
};

type ToggleableColumn = 'input' | 'entity';
const TOGGLEABLE_COLUMNS: ToggleableColumn[] = ['input', 'entity'];
const COLUMN_LABELS: Record<ToggleableColumn, string> = { input: 'Input', entity: 'Entity' };

const SCORE_ENTITIES = [
  'weather-agent',
  'summarise-workflow',
  'translation-agent',
  'recipe-generator',
  'sentiment-scorer',
];

const SCORE_SAMPLE_INPUTS = [
  'What is the current weather in Tokyo?',
  'Summarise the Q2 sales report.',
  'Translate this paragraph to Japanese.',
  'Generate a recipe for banana bread.',
  'Explain supervised vs unsupervised learning.',
];

const LONG_INPUT = JSON.stringify({
  messages: [
    {
      role: 'system',
      content:
        'You are a highly capable AI assistant with deep expertise in data analysis, business intelligence, financial summarisation, multilingual translation, and multi-step reasoning. You always respond in a structured, concise, and actionable format, citing evidence from the provided context where possible.',
    },
    {
      role: 'user',
      content:
        'Please analyse the following dataset in full detail and provide a comprehensive executive summary that includes: (1) overall revenue trends across Q1 and Q2, (2) top-performing and underperforming regions, (3) anomalies or outliers that may indicate data quality issues or exceptional market conditions, (4) year-over-year growth comparisons where data is available, and (5) at least three concrete, prioritised, actionable recommendations for the sales leadership team based on your findings.',
    },
  ],
  model: 'claude-sonnet-4-5',
  temperature: 0.7,
  max_tokens: 4096,
  metadata: { source: 'dashboard', requestId: 'req_abc123xyz', region: 'us-east-1' },
});

const SAMPLE_SCORES = Array.from({ length: 25 }, (_, i) => ({
  id: `score_${String(i + 1).padStart(4, '0')}`,
  createdAt: new Date(Date.now() - i * 1_800_000).toISOString(),
  score: Number((0.4 + (i % 7) * 0.08).toFixed(2)),
  entityId: SCORE_ENTITIES[i % SCORE_ENTITIES.length],
  input:
    i === 2
      ? LONG_INPUT
      : JSON.stringify({
          messages: [{ role: 'user', content: SCORE_SAMPLE_INPUTS[i % SCORE_SAMPLE_INPUTS.length] }],
          model: 'claude-sonnet-4-5',
          temperature: 0.7,
        }),
}));

function buildScoresColumns(visible: Set<ToggleableColumn>): string {
  const parts = ['auto', 'auto', 'minmax(0, 10rem)'];
  if (visible.has('entity')) parts.push('minmax(0, 14rem)');
  if (visible.has('input')) parts.push('minmax(0, 40rem)');
  return parts.join(' ');
}

/** Scorer data table: Score is always visible, Input/Entity are toggleable. */
export const ScoresTable: Story = {
  parameters: { layout: 'padded', controls: { exclude: ['variant', 'stickyHeaderBackground'] } },
  render: function ScoresTableStory() {
    const [hiddenColumns, setHiddenColumns] = useState<Set<ToggleableColumn>>(new Set());
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

    const visibleColumns = useMemo(
      () => new Set<ToggleableColumn>(TOGGLEABLE_COLUMNS.filter(c => !hiddenColumns.has(c))),
      [hiddenColumns],
    );
    const columns = useMemo(() => buildScoresColumns(visibleColumns), [visibleColumns]);

    const toggleColumn = useCallback((col: ToggleableColumn) => {
      setHiddenColumns(prev => {
        const next = new Set(prev);
        if (next.has(col)) next.delete(col);
        else next.add(col);
        return next;
      });
    }, []);

    return (
      <div className="flex h-120 min-h-0 flex-col gap-0">
        <div className="flex shrink-0 items-center justify-end pb-2">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon className="size-3.5" />
                Columns
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
              {TOGGLEABLE_COLUMNS.map(col => (
                <DropdownMenu.CheckboxItem
                  key={col}
                  checked={visibleColumns.has(col)}
                  onClick={() => toggleColumn(col)}
                >
                  {COLUMN_LABELS[col]}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <ScoresDataList columns={columns} className="min-h-0 flex-1">
          <ScoresDataList.Top>
            <ScoresDataList.TopCell>Date</ScoresDataList.TopCell>
            <ScoresDataList.TopCell>Time</ScoresDataList.TopCell>
            <ScoresDataList.TopCell>Score</ScoresDataList.TopCell>
            {visibleColumns.has('entity') && <ScoresDataList.TopCell>Entity</ScoresDataList.TopCell>}
            {visibleColumns.has('input') && <ScoresDataList.TopCell>Input</ScoresDataList.TopCell>}
          </ScoresDataList.Top>

          {SAMPLE_SCORES.map(score => (
            <ScoresDataList.RowButton
              key={score.id}
              onClick={() => setSelectedId(id => (id === score.id ? undefined : score.id))}
              className={selectedId === score.id ? 'bg-surface4' : ''}
            >
              <ScoresDataList.DateCell timestamp={score.createdAt} />
              <ScoresDataList.TimeCell timestamp={score.createdAt} />
              <ScoresDataList.ScoreCell score={score.score} />
              {visibleColumns.has('entity') && <ScoresDataList.EntityCell entityId={score.entityId} />}
              {visibleColumns.has('input') && <ScoresDataList.InputCell input={score.input} />}
            </ScoresDataList.RowButton>
          ))}
        </ScoresDataList>
      </div>
    );
  },
};

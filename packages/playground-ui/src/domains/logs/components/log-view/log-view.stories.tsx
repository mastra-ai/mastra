import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { LogLevel, LogRecord, LogViewLine } from '../../types';
import type { LogViewNextPage, LogViewOrder } from '../log-view-list';
import { LogView, filterLogsByFields } from './index';
import type { LogViewHeight } from './index';
import type { FilterBarItem } from '@/ds/components/FilterBar';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { IconConsole } from '@/ds/icons/central/IconConsole';
import { IconHammer } from '@/ds/icons/central/IconHammer';
import { IconServer } from '@/ds/icons/central/IconServer';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

type SandboxLine = LogRecord & Pick<LogViewLine, 'icon'>;

const sandboxIcon = { element: <IconServer />, label: 'Sandbox' };
const processIcon = { element: <IconConsole />, label: 'Process' };

const logs: SandboxLine[] = [
  {
    timestamp: '2026-11-24T09:29:30.956Z',
    level: 'warn',
    message: 'Memory usage above 80% of limit',
    data: { used_mb: '842', limit_mb: '1024' },
    icon: sandboxIcon,
  },
  {
    timestamp: '2026-11-24T09:31:07.956Z',
    level: 'info',
    message: 'Process.Start stream ended',
    data: { operation_id: 'op_8f21', exit_code: '0' },
    icon: processIcon,
  },
  {
    timestamp: '2026-11-24T09:32:44.956Z',
    level: 'debug',
    message: 'envd: received exec request',
    data: { cmd: 'pnpm install --frozen-lockfile', cwd: '/home/user/app' },
    icon: processIcon,
  },
  {
    timestamp: '2026-11-24T09:35:58.956Z',
    level: 'error',
    message:
      "Command failed: node server.js, Error: Cannot find module '/home/user/app/dist/server-with-a-really-long-filename-that-should-wrap.js'",
    data: { operation_id: 'op_a771', exit_code: '1' },
    icon: processIcon,
  },
  {
    timestamp: '2026-11-24T09:36:01.956Z',
    level: 'error',
    message: [
      'Error: boom',
      '    at Object.<anonymous> (/home/user/app/server.js:12:9)',
      '    at Module._compile (node:internal/modules/cjs/loader:1256:14)',
      '    at Module.load (node:internal/modules/cjs/loader:1119:32)',
      '    at node:internal/main/run_main_module:28:49',
    ].join('\n'),
    icon: processIcon,
  },
];

interface CompositionProps {
  logs: SandboxLine[];
  order?: LogViewOrder;
  nextPage?: LogViewNextPage;
  wrap?: boolean;
  search?: boolean;
  fieldChips?: boolean;
  filters?: boolean;
  initialFilters?: FilterBarItem[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  onRefresh: () => void;
  onLogClick?: (log: SandboxLine) => void;
  height?: LogViewHeight;
}

type CompositionBodyProps = Omit<
  CompositionProps,
  'logs' | 'filters' | 'search' | 'fieldChips' | 'initialFilters' | 'onRefresh' | 'height'
> & {
  lines: SandboxLine[];
  logIdMap: Map<SandboxLine, string>;
  onClearFilters?: () => void;
};

function CompositionBody({ lines, onClearFilters, ...listProps }: CompositionBodyProps) {
  if (!listProps.isLoading && lines.length === 0) return <LogView.Empty onClearFilters={onClearFilters} />;
  return <LogView.List logs={lines} {...listProps} />;
}

function Composition({
  logs: allLogs,
  filters = true,
  search,
  fieldChips,
  initialFilters = [],
  onRefresh,
  height,
  ...listProps
}: CompositionProps) {
  const [levels, setLevels] = useState<LogLevel[]>(LEVELS);
  const [items, setItems] = useState<FilterBarItem[]>(initialFilters);
  const lines = filterLogsByFields(
    allLogs.filter(log => levels.includes(log.level)),
    items,
  );
  const logIdMap = new Map(allLogs.map((log, index) => [log, `line-${index}`]));
  const filtered = items.length > 0 || levels.length !== LEVELS.length;
  const clearFilters = () => {
    setItems([]);
    setLevels(LEVELS);
  };

  return (
    <LogView height={height}>
      <LogView.Header>
        <LogView.Title />
        <LogView.LevelToggles size="sm" levels={LEVELS} value={levels} onValueChange={setLevels} />
        {filters && (
          <LogView.Filters
            logs={allLogs}
            value={items}
            onValueChange={setItems}
            search={search}
            fieldChips={fieldChips}
          />
        )}
        <LogView.Actions>
          <LogView.Count count={lines.length} />
          <LogView.Refresh onRefresh={onRefresh} />
        </LogView.Actions>
      </LogView.Header>
      <CompositionBody
        lines={lines}
        logIdMap={logIdMap}
        onClearFilters={filtered ? clearFilters : undefined}
        {...listProps}
      />
    </LogView>
  );
}

const describe = (story: string) => ({ docs: { description: { story } } });

const meta = {
  title: 'Domains/Logs/LogView',
  component: Composition,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="p-6">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    logs,
    order: 'oldest-first',
    onRefresh: fn(),
    onLogClick: fn(),
    onFetchNextPage: fn(),
  },
} satisfies Meta<typeof Composition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: describe(
    'Oldest first like a terminal, opening on the newest line. Click a level to hide it, Cmd or Ctrl-click to show only it, and pick a field in the filter bar to filter by its value.',
  ),
};

export const NewestFirst: Story = {
  args: { order: 'newest-first' },
  parameters: describe('Newest first like an audit log; older logs load at the bottom.'),
};

export const NoWrap: Story = {
  args: { wrap: false },
  parameters: describe('Each line stays on one row and the list scrolls sideways.'),
};

export const ReadOnly: Story = {
  args: { onLogClick: undefined },
  parameters: describe('Without onLogClick, lines are plain rows that open nothing.'),
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const LoadingOlder: Story = {
  args: { hasNextPage: true, isFetchingNextPage: true },
  parameters: describe('The loading line sits at the older end and keeps its height between pages.'),
};

export const LoadingNewer: Story = {
  args: {
    logs: Array.from({ length: 8 }, () => logs.map(log => ({ ...log }))).flat(),
    order: 'oldest-first',
    nextPage: 'newer',
    hasNextPage: true,
    isFetchingNextPage: true,
  },
  parameters: describe(
    'nextPage="newer" for an API that pages forward in time: the list opens at the top and newer logs load at the bottom.',
  ),
};

export const Empty: Story = {
  args: { logs: [] },
};

export const FilteredEmpty: Story = {
  args: {
    initialFilters: [{ id: 'field:exit_code', fieldId: 'field:exit_code', operatorId: 'is', value: '9' }],
  },
  parameters: describe('When filters hide every line, the empty state offers to clear them.'),
};

export const SearchOnly: Story = {
  args: { fieldChips: false },
};

export const FieldChipsOnly: Story = {
  args: { search: false },
};

export const NoFilters: Story = {
  args: { filters: false },
  parameters: describe('Leave LogView.Filters out to drop filtering entirely.'),
};

const ESC = String.fromCharCode(27);
const buildIcon = { element: <IconHammer />, label: 'Build' };
const runtimeIcon = { element: <IconServer />, label: 'Runtime' };

const buildOutput: LogViewLine[] = [
  { message: 'Cloning github.com/acme/agent-app (branch: main)', icon: buildIcon },
  { message: `${ESC}[1mmastra build${ESC}[0m`, icon: buildIcon },
  { message: `${ESC}[90mResolving dependencies${ESC}[0m`, icon: buildIcon },
  {
    level: 'warn',
    message: 'deprecated inflight@1.0.6: This module is not supported',
    icon: buildIcon,
  },
  {
    message: `${ESC}[32m✓${ESC}[0m Bundled 42 modules in ${ESC}[1m1.8s${ESC}[0m`,
    icon: buildIcon,
  },
  {
    timestamp: '2026-11-24T09:36:01.956Z',
    level: 'info',
    message: 'Server listening on :4111',
    icon: runtimeIcon,
  },
  {
    timestamp: '2026-11-24T09:36:04.103Z',
    level: 'error',
    message: `${ESC}[31mError: connect ECONNREFUSED 127.0.0.1:5432${ESC}[0m`,
    icon: runtimeIcon,
  },
];

const longBuildOutput: LogViewLine[] = [
  ...Array.from({ length: 60 }, (_, index) => ({
    message: `#${index + 5} [builder 3/7] RUN pnpm install --frozen-lockfile`,
    icon: buildIcon,
  })),
  ...buildOutput,
];

const buildIds = new Map(buildOutput.map((line, index) => [line, `build-${index}`]));

const longBuildIds = new Map(longBuildOutput.map((line, index) => [line, `long-build-${index}`]));

export const BuildOutput: Story = {
  render: () => (
    <LogView>
      <LogView.Header>
        <LogView.Title>Build logs</LogView.Title>
        <LogView.Actions>
          <LogView.Count count={buildOutput.length} />
          <LogView.Copy content={buildOutput.map(line => line.message).join('\n')} />
        </LogView.Actions>
      </LogView.Header>
      <LogView.List logs={buildOutput} logIdMap={buildIds} order="oldest-first" />
    </LogView>
  ),
  parameters: describe(
    'Deploy output: lines without a time or level, terminal colors, an icon for where each line came from, named on hover, and the line count and copy in the header.',
  ),
};

export const FullHeight: Story = {
  args: { height: 'fill' },
  decorators: [
    Story => (
      <div className="h-160">
        <Story />
      </div>
    ),
  ],
  parameters: describe('height="fill" makes the panel fill its container, for a page that is only logs.'),
};

export const LongBuildOutput: Story = {
  render: () => (
    <LogView>
      <LogView.Header>
        <LogView.Title>Build logs</LogView.Title>
        <LogView.Actions>
          <LogView.Count count={longBuildOutput.length} />
        </LogView.Actions>
      </LogView.Header>
      <LogView.List logs={longBuildOutput} logIdMap={longBuildIds} order="oldest-first" />
    </LogView>
  ),
  parameters: describe(
    'Columns keep their width while scrolling, even when only lines without a time or level are on screen.',
  ),
};

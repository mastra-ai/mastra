import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { LogLevel, LogRecord } from '../../types';
import type { LogViewOrder } from '../log-view-list';
import { LogView, filterLogsByFields } from './index';
import type { FilterBarItem } from '@/ds/components/FilterBar';
import { TooltipProvider } from '@/ds/components/Tooltip';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

const logs: LogRecord[] = [
  {
    timestamp: '2026-11-24T09:29:30.956Z',
    level: 'warn',
    message: 'Memory usage above 80% of limit',
    data: { used_mb: '842', limit_mb: '1024' },
  },
  {
    timestamp: '2026-11-24T09:31:07.956Z',
    level: 'info',
    message: 'Process.Start stream ended',
    data: { operation_id: 'op_8f21', exit_code: '0' },
  },
  {
    timestamp: '2026-11-24T09:32:44.956Z',
    level: 'debug',
    message: 'envd: received exec request',
    data: { cmd: 'pnpm install --frozen-lockfile', cwd: '/home/user/app' },
  },
  {
    timestamp: '2026-11-24T09:35:58.956Z',
    level: 'error',
    message:
      "Command failed: node server.js, Error: Cannot find module '/home/user/app/dist/server-with-a-really-long-filename-that-should-wrap.js'",
    data: { operation_id: 'op_a771', exit_code: '1' },
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
  },
];

interface CompositionProps {
  logs: LogRecord[];
  order?: LogViewOrder;
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
  onLogClick?: (log: LogRecord) => void;
}

function Composition({
  logs: allLogs,
  filters = true,
  search,
  fieldChips,
  initialFilters = [],
  onRefresh,
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

  return (
    <LogView>
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
        <LogView.Refresh onRefresh={onRefresh} />
      </LogView.Header>
      {!listProps.isLoading && lines.length === 0 ? (
        <LogView.Empty
          onClearFilters={
            filtered
              ? () => {
                  setItems([]);
                  setLevels(LEVELS);
                }
              : undefined
          }
        />
      ) : (
        <LogView.List logs={lines} logIdMap={logIdMap} {...listProps} />
      )}
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

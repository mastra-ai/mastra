import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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

const logIdMap = new Map(logs.map((log, index) => [log, `line-${index}`]));

interface CompositionProps {
  order?: LogViewOrder;
  wrap?: boolean;
  search?: boolean;
  fieldChips?: boolean;
  filters?: boolean;
}

function Composition({ order, wrap, search, fieldChips, filters = true }: CompositionProps) {
  const [levels, setLevels] = useState<LogLevel[]>(LEVELS);
  const [items, setItems] = useState<FilterBarItem[]>([]);
  const lines = filterLogsByFields(
    logs.filter(log => levels.includes(log.level)),
    items,
  );

  return (
    <LogView>
      <LogView.Header>
        <LogView.Title />
        <LogView.LevelToggles size="sm" levels={LEVELS} value={levels} onValueChange={setLevels} />
        {filters && (
          <LogView.Filters logs={logs} value={items} onValueChange={setItems} search={search} fieldChips={fieldChips} />
        )}
        <LogView.Refresh onRefresh={() => {}} />
      </LogView.Header>
      {lines.length === 0 ? (
        <LogView.Empty
          onClearFilters={() => {
            setItems([]);
            setLevels(LEVELS);
          }}
        />
      ) : (
        <LogView.List logs={lines} logIdMap={logIdMap} order={order} wrap={wrap} />
      )}
    </LogView>
  );
}

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
  args: { order: 'oldest-first' },
} satisfies Meta<typeof Composition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NewestFirst: Story = { args: { order: 'newest-first' } };

export const NoWrap: Story = { args: { wrap: false } };

export const SearchOnly: Story = { args: { fieldChips: false } };

export const FieldChipsOnly: Story = { args: { search: false } };

export const NoFilters: Story = { args: { filters: false } };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { LogLevel } from './log-level-styles';
import { LogStream } from './index';

const lines: Array<{
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  fields?: Record<string, string>;
}> = [
  {
    id: 'line-1',
    timestamp: '2026-11-24T09:29:30.956Z',
    level: 'warn',
    message: 'Memory usage above 80% of limit',
    fields: { used_mb: '842', limit_mb: '1024' },
  },
  {
    id: 'line-2',
    timestamp: '2026-11-24T09:31:07.956Z',
    level: 'info',
    message: 'Process.Start stream ended',
    fields: { operation_id: 'op_8f21', exit_code: '0' },
  },
  {
    id: 'line-3',
    timestamp: '2026-11-24T09:32:44.956Z',
    level: 'debug',
    message: 'envd: received exec request',
    fields: { cmd: 'pnpm install --frozen-lockfile', cwd: '/home/user/app' },
  },
  {
    id: 'line-4',
    timestamp: '2026-11-24T09:35:58.956Z',
    level: 'error',
    message:
      "Command failed: node server.js, Error: Cannot find module '/home/user/app/dist/server-with-a-really-long-filename-that-should-wrap.js'",
    fields: { operation_id: 'op_a771', exit_code: '1' },
  },
  {
    id: 'line-5',
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

interface StreamProps {
  wrap?: boolean;
  onLineClick?: (id: string) => void;
}

function Stream({ wrap, onLineClick }: StreamProps) {
  return (
    <div className="flex h-80 flex-col">
      <LogStream wrap={wrap} className="flex-1">
        <LogStream.Header>
          <LogStream.HeaderCell>Time</LogStream.HeaderCell>
          <LogStream.HeaderCell>Level</LogStream.HeaderCell>
          <LogStream.HeaderCell>Message</LogStream.HeaderCell>
        </LogStream.Header>
        {lines.map(({ id, ...line }) => {
          const content = <LogStream.Line {...line} wrap={wrap} collapse={onLineClick !== undefined} />;
          if (!onLineClick) {
            return (
              <LogStream.Row key={id} level={line.level}>
                {content}
              </LogStream.Row>
            );
          }
          return (
            <LogStream.RowButton key={id} level={line.level} featured={id === 'line-2'} onClick={() => onLineClick(id)}>
              {content}
            </LogStream.RowButton>
          );
        })}
      </LogStream>
    </div>
  );
}

const meta = {
  title: 'DataDisplay/LogStream',
  component: Stream,
  parameters: { layout: 'padded' },
  args: { onLineClick: fn() },
} satisfies Meta<typeof Stream>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoWrap: Story = { args: { wrap: false } };

export const ReadOnly: Story = { args: { onLineClick: undefined } };

export const Empty: Story = {
  render: () => (
    <div className="flex h-80 flex-col">
      <LogStream.Frame className="flex-1" />
    </div>
  ),
};

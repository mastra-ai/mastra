import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { LogsDataList, LogsDataListSkeleton } from './index';

const columns = '8rem 6rem 5rem minmax(10rem,14rem) minmax(18rem,1fr) minmax(14rem,1fr)';

const logs = [
  {
    id: 'log-1',
    timestamp: '2026-08-26T19:42:12.000Z',
    level: 'info',
    entityType: 'agent',
    entityName: 'Research agent',
    message: 'Agent run completed',
    data: { durationMs: 842, tokens: 1240 },
  },
  {
    id: 'log-2',
    timestamp: '2026-08-26T19:41:59.000Z',
    level: 'warn',
    entityType: 'workflow',
    entityName: 'Daily report workflow',
    message: 'Retrying step after provider timeout',
    data: { step: 'summarize', attempt: 2 },
  },
  {
    id: 'log-3',
    timestamp: '2026-08-26T19:41:42.000Z',
    level: 'error',
    entityType: 'tool',
    entityName: 'web-search',
    message: 'Tool execution failed with a realistically long message that must truncate inside the row',
    data: { code: 'RATE_LIMITED' },
  },
] as const;

const meta: Meta<typeof LogsDataList> = {
  title: 'DataDisplay/LogsDataList',
  component: LogsDataList,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof LogsDataList>;

function Header() {
  return (
    <LogsDataList.Top>
      <LogsDataList.TopCell>Date</LogsDataList.TopCell>
      <LogsDataList.TopCell>Time</LogsDataList.TopCell>
      <LogsDataList.TopCell>Level</LogsDataList.TopCell>
      <LogsDataList.TopCell>Entity</LogsDataList.TopCell>
      <LogsDataList.TopCell>Message</LogsDataList.TopCell>
      <LogsDataList.TopCell>Data</LogsDataList.TopCell>
    </LogsDataList.Top>
  );
}

export const Populated: Story = {
  render: () => (
    <div className="h-80">
      <LogsDataList columns={columns}>
        <Header />
        {logs.map(log => (
          <LogsDataList.RowButton key={log.id} onClick={fn()}>
            <LogsDataList.DateCell timestamp={log.timestamp} />
            <LogsDataList.TimeCell timestamp={log.timestamp} />
            <LogsDataList.LevelCell level={log.level} />
            <LogsDataList.EntityCell entityType={log.entityType} entityName={log.entityName} />
            <LogsDataList.MessageCell message={log.message} />
            <LogsDataList.DataCell data={log.data} />
          </LogsDataList.RowButton>
        ))}
      </LogsDataList>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72">
      <LogsDataListSkeleton columns={columns} />
    </div>
  ),
};

const streamLines = [
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
] as const;

export const Stream: Story = {
  render: () => (
    <div className="h-80">
      <LogsDataList columns="minmax(0,1fr)" fit="container" variant="light" density="compact">
        {streamLines.map(line => (
          <LogsDataList.RowButton key={line.id} onClick={fn()}>
            <LogsDataList.LineCell
              timestamp={line.timestamp}
              level={line.level}
              message={line.message}
              fields={line.fields}
            />
          </LogsDataList.RowButton>
        ))}
      </LogsDataList>
    </div>
  ),
};

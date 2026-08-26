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
      <LogsDataList columns={columns} variant="striped">
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

export const NoMatches: Story = {
  render: () => (
    <div className="h-64">
      <LogsDataList columns={columns}>
        <Header />
        <LogsDataList.NoMatch message="No logs match your filters" />
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

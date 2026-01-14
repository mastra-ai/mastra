import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntryList } from './entry-list';
import { Badge } from '../Badge';
import { Bot, Workflow } from 'lucide-react';

const meta: Meta<typeof EntryList> = {
  title: 'DataDisplay/EntryList',
  component: EntryList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EntryList>;

const columns = [
  { key: 'name', label: 'Name', width: '1fr' },
  { key: 'status', label: 'Status', width: 'auto' },
];

const agentColumns = [
  { key: 'name', label: 'Agent', width: '1fr' },
  { key: 'model', label: 'Model', width: '120px' },
  { key: 'status', label: 'Status', width: '100px' },
];

export const Default: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header title="Items" count={3} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item One</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item Two</EntryList.EntryText>
            <EntryList.EntryStatus status="warning">Pending</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '3' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item Three</EntryList.EntryText>
            <EntryList.EntryStatus status="error">Error</EntryList.EntryStatus>
          </EntryList.Entry>
        </EntryList.Entries>
      </EntryList>
    </div>
  ),
};

export const WithSelectedItem: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header title="Items" count={3} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }}>
            <EntryList.EntryText>Item One</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }} isSelected>
            <EntryList.EntryText>Item Two (Selected)</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '3' }}>
            <EntryList.EntryText>Item Three</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
        </EntryList.Entries>
      </EntryList>
    </div>
  ),
};

export const EmptyList: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header title="Items" count={0} />
        <EntryList.Message>No items found. Create your first item to get started.</EntryList.Message>
      </EntryList>
    </div>
  ),
};

export const WithPagination: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header title="Items" count={100} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }}>
            <EntryList.EntryText>Item 1</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }}>
            <EntryList.EntryText>Item 2</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Active</EntryList.EntryStatus>
          </EntryList.Entry>
        </EntryList.Entries>
        <EntryList.Pagination currentPage={1} totalPages={10} onPageChange={page => console.log('Page:', page)} />
      </EntryList>
    </div>
  ),
};

export const AgentsList: Story = {
  render: () => (
    <div className="w-[600px]">
      <EntryList>
        <EntryList.Header title="Agents" count={2} />
        <EntryList.Entries>
          <EntryList.Entry columns={agentColumns} entry={{ id: 'agent-1' }}>
            <EntryList.EntryText>Customer Support Agent</EntryList.EntryText>
            <EntryList.EntryText>GPT-4</EntryList.EntryText>
            <EntryList.EntryStatus status="success">Online</EntryList.EntryStatus>
          </EntryList.Entry>
          <EntryList.Entry columns={agentColumns} entry={{ id: 'agent-2' }}>
            <EntryList.EntryText>Data Analysis Agent</EntryList.EntryText>
            <EntryList.EntryText>Claude 3</EntryList.EntryText>
            <EntryList.EntryStatus status="warning">Idle</EntryList.EntryStatus>
          </EntryList.Entry>
        </EntryList.Entries>
      </EntryList>
    </div>
  ),
};

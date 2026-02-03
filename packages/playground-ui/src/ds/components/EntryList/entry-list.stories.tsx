import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntryList } from './entry-list';
import type { EntryListColumn } from './types';

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

const columns: EntryListColumn[] = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'status', label: 'Status', size: '100px' },
];

const agentColumns: EntryListColumn[] = [
  { name: 'name', label: 'Agent', size: '1fr' },
  { name: 'model', label: 'Model', size: '120px' },
  { name: 'status', label: 'Status', size: '100px' },
];

export const Default: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header columns={columns} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item One</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item Two</EntryList.EntryText>
            <EntryList.EntryStatus status="error" />
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '3' }} onClick={id => console.log('Clicked:', id)}>
            <EntryList.EntryText>Item Three</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
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
        <EntryList.Header columns={columns} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }}>
            <EntryList.EntryText>Item One</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }} isSelected>
            <EntryList.EntryText>Item Two (Selected)</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '3' }}>
            <EntryList.EntryText>Item Three</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
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
        <EntryList.Header columns={columns} />
        <EntryList.Message>No items found. Create your first item to get started.</EntryList.Message>
      </EntryList>
    </div>
  ),
};

export const WithPagination: Story = {
  render: () => (
    <div className="w-[500px]">
      <EntryList>
        <EntryList.Header columns={columns} />
        <EntryList.Entries>
          <EntryList.Entry columns={columns} entry={{ id: '1' }}>
            <EntryList.EntryText>Item 1</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
          <EntryList.Entry columns={columns} entry={{ id: '2' }}>
            <EntryList.EntryText>Item 2</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
        </EntryList.Entries>
        <EntryList.Pagination currentPage={0} hasMore={true} onNextPage={() => console.log('Next')} />
      </EntryList>
    </div>
  ),
};

export const AgentsList: Story = {
  render: () => (
    <div className="w-[600px]">
      <EntryList>
        <EntryList.Header columns={agentColumns} />
        <EntryList.Entries>
          <EntryList.Entry columns={agentColumns} entry={{ id: 'agent-1' }}>
            <EntryList.EntryText>Customer Support Agent</EntryList.EntryText>
            <EntryList.EntryText>GPT-4</EntryList.EntryText>
            <EntryList.EntryStatus status="success" />
          </EntryList.Entry>
          <EntryList.Entry columns={agentColumns} entry={{ id: 'agent-2' }}>
            <EntryList.EntryText>Data Analysis Agent</EntryList.EntryText>
            <EntryList.EntryText>Claude 3</EntryList.EntryText>
            <EntryList.EntryStatus status="error" />
          </EntryList.Entry>
        </EntryList.Entries>
      </EntryList>
    </div>
  ),
};

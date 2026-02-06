import type { Meta, StoryObj } from '@storybook/react-vite';
import { ItemList } from './item-list';
import type { Column } from './types';

const meta: Meta<typeof ItemList> = {
  title: 'DataDisplay/ItemList',
  component: ItemList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ItemList>;

const columns: Column[] = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'status', label: 'Status', size: '100px' },
];

const agentColumns: Column[] = [
  { name: 'name', label: 'Agent', size: '1fr' },
  { name: 'model', label: 'Model', size: '120px' },
  { name: 'status', label: 'Status', size: '100px' },
];

export const Default: Story = {
  render: () => (
    <div className="w-[500px]">
      <ItemList>
        <ItemList.Header columns={columns} />
        <ItemList.Items>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '1' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.ItemText>Item One</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '2' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.ItemText>Item Two</ItemList.ItemText>
              <ItemList.ItemStatus status="failed" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '3' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.ItemText>Item Three</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
        </ItemList.Items>
      </ItemList>
    </div>
  ),
};

export const WithSelectedItem: Story = {
  render: () => (
    <div className="w-[500px]">
      <ItemList>
        <ItemList.Header columns={columns} />
        <ItemList.Items>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '1' }}>
              <ItemList.ItemText>Item One</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row isSelected>
            <ItemList.RowButton columns={columns} entry={{ id: '2' }} isSelected>
              <ItemList.ItemText>Item Two (Selected)</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '3' }}>
              <ItemList.ItemText>Item Three</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
        </ItemList.Items>
      </ItemList>
    </div>
  ),
};

export const EmptyList: Story = {
  render: () => (
    <div className="w-[500px]">
      <ItemList>
        <ItemList.Header columns={columns} />
        <ItemList.Message>No items found. Create your first item to get started.</ItemList.Message>
      </ItemList>
    </div>
  ),
};

export const WithPagination: Story = {
  render: () => (
    <div className="w-[500px]">
      <ItemList>
        <ItemList.Header columns={columns} />
        <ItemList.Items>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '1' }}>
              <ItemList.ItemText>Item 1</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} entry={{ id: '2' }}>
              <ItemList.ItemText>Item 2</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
        </ItemList.Items>
        <ItemList.Pagination currentPage={0} hasMore={true} onNextPage={() => console.log('Next')} />
      </ItemList>
    </div>
  ),
};

export const AgentsList: Story = {
  render: () => (
    <div className="w-[600px]">
      <ItemList>
        <ItemList.Header columns={agentColumns} />
        <ItemList.Items>
          <ItemList.Row>
            <ItemList.RowButton columns={agentColumns} entry={{ id: 'agent-1' }}>
              <ItemList.ItemText>Customer Support Agent</ItemList.ItemText>
              <ItemList.ItemText>GPT-4</ItemList.ItemText>
              <ItemList.ItemStatus status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={agentColumns} entry={{ id: 'agent-2' }}>
              <ItemList.ItemText>Data Analysis Agent</ItemList.ItemText>
              <ItemList.ItemText>Claude 3</ItemList.ItemText>
              <ItemList.ItemStatus status="failed" />
            </ItemList.RowButton>
          </ItemList.Row>
        </ItemList.Items>
      </ItemList>
    </div>
  ),
};

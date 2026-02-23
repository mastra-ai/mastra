import type { Meta, StoryObj } from '@storybook/react-vite';
import { ItemList } from './item-list';
import type { ItemListColumn } from './types';

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

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'status', label: 'Status', size: '100px' },
];

const agentColumns: ItemListColumn[] = [
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
            <ItemList.RowButton columns={columns} item={{ id: '1' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.TextCell>Item One</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} item={{ id: '2' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.TextCell>Item Two</ItemList.TextCell>
              <ItemList.StatusCell status="failed" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} item={{ id: '3' }} onClick={id => console.log('Clicked:', id)}>
              <ItemList.TextCell>Item Three</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
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
            <ItemList.RowButton columns={columns} item={{ id: '1' }}>
              <ItemList.TextCell>Item One</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row isSelected>
            <ItemList.RowButton columns={columns} item={{ id: '2' }} isFeatured>
              <ItemList.TextCell>Item Two (Selected)</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} item={{ id: '3' }}>
              <ItemList.TextCell>Item Three</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
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
            <ItemList.RowButton columns={columns} item={{ id: '1' }}>
              <ItemList.TextCell>Item 1</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={columns} item={{ id: '2' }}>
              <ItemList.TextCell>Item 2</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
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
            <ItemList.RowButton columns={agentColumns} item={{ id: 'agent-1' }}>
              <ItemList.TextCell>Customer Support Agent</ItemList.TextCell>
              <ItemList.TextCell>GPT-4</ItemList.TextCell>
              <ItemList.StatusCell status="success" />
            </ItemList.RowButton>
          </ItemList.Row>
          <ItemList.Row>
            <ItemList.RowButton columns={agentColumns} item={{ id: 'agent-2' }}>
              <ItemList.TextCell>Data Analysis Agent</ItemList.TextCell>
              <ItemList.TextCell>Claude 3</ItemList.TextCell>
              <ItemList.StatusCell status="failed" />
            </ItemList.RowButton>
          </ItemList.Row>
        </ItemList.Items>
      </ItemList>
    </div>
  ),
};

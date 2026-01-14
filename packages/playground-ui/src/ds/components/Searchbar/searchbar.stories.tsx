import type { Meta, StoryObj } from '@storybook/react-vite';
import { Searchbar, SearchbarWrapper } from './searchbar';
import { useState } from 'react';

const meta: Meta<typeof Searchbar> = {
  title: 'Composite/Searchbar',
  component: Searchbar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Searchbar>;

export const Default: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    onSearch: (value: string) => console.log('Search:', value),
  },
  render: args => (
    <div className="w-[300px]">
      <Searchbar {...args} />
    </div>
  ),
};

export const AgentSearch: Story = {
  render: () => (
    <div className="w-[300px]">
      <Searchbar
        label="Search agents"
        placeholder="Search agents..."
        onSearch={value => console.log('Search:', value)}
      />
    </div>
  ),
};

export const WithCustomDebounce: Story = {
  render: () => (
    <div className="w-[300px]">
      <Searchbar
        label="Search"
        placeholder="Search (500ms debounce)..."
        debounceMs={500}
        onSearch={value => console.log('Search:', value)}
      />
    </div>
  ),
};

export const WithWrapper: Story = {
  render: () => (
    <div className="w-[300px] bg-surface2 rounded-lg">
      <SearchbarWrapper>
        <Searchbar
          label="Search workflows"
          placeholder="Search workflows..."
          onSearch={value => console.log('Search:', value)}
        />
      </SearchbarWrapper>
    </div>
  ),
};

const InteractiveSearchDemo = () => {
  const [results, setResults] = useState<string[]>([]);
  const allItems = ['Customer Support Agent', 'Sales Assistant', 'Data Processor', 'Code Reviewer', 'Research Bot'];

  const handleSearch = (value: string) => {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const filtered = allItems.filter(item => item.toLowerCase().includes(value.toLowerCase()));
    setResults(filtered);
  };

  return (
    <div className="w-[300px] space-y-2">
      <Searchbar
        label="Search agents"
        placeholder="Type to search agents..."
        onSearch={handleSearch}
        debounceMs={200}
      />
      {results.length > 0 && (
        <ul className="bg-surface3 rounded-md p-2 space-y-1">
          {results.map(result => (
            <li key={result} className="text-sm text-icon5 p-1">
              {result}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const InteractiveSearch: Story = {
  render: () => <InteractiveSearchDemo />,
};

export const InSidebarContext: Story = {
  render: () => (
    <div className="w-[280px] bg-surface2 border border-border1 rounded-lg">
      <SearchbarWrapper>
        <Searchbar label="Search" placeholder="Search..." onSearch={value => console.log('Search:', value)} />
      </SearchbarWrapper>
      <div className="p-4 space-y-2">
        <div className="h-8 bg-surface3 rounded" />
        <div className="h-8 bg-surface3 rounded" />
        <div className="h-8 bg-surface3 rounded" />
      </div>
    </div>
  ),
};

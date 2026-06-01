import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Searchbar, SearchbarWrapper } from './searchbar';

const meta: Meta<typeof Searchbar> = {
  title: 'Composite/Searchbar',
  component: Searchbar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'outline'],
    },
  },
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
    <div className="w-dropdown-max-height">
      <Searchbar {...args} />
    </div>
  ),
};

export const AgentSearch: Story = {
  render: () => (
    <div className="w-dropdown-max-height">
      <Searchbar
        label="Search agents"
        placeholder="Search agents..."
        onSearch={value => console.log('Search:', value)}
      />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-dropdown-max-height">
      <Searchbar
        variant="default"
        label="Search"
        placeholder="Default"
        onSearch={value => console.log('Search:', value)}
      />
      <Searchbar
        variant="filled"
        label="Search"
        placeholder="Filled"
        onSearch={value => console.log('Search:', value)}
      />
      <Searchbar
        variant="outline"
        label="Search"
        placeholder="Outline"
        onSearch={value => console.log('Search:', value)}
      />
    </div>
  ),
};

export const WithCustomDebounce: Story = {
  render: () => (
    <div className="w-dropdown-max-height">
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
    <div className="w-dropdown-max-height bg-surface2 rounded-lg">
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
    <div className="w-dropdown-max-height space-y-2">
      <Searchbar
        label="Search agents"
        placeholder="Type to search agents..."
        onSearch={handleSearch}
        debounceMs={200}
      />
      {results.length > 0 && (
        <ul className="bg-surface3 rounded-md p-2 space-y-1">
          {results.map(result => (
            <li key={result} className="text-sm text-neutral5 p-1">
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

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-dropdown-max-height">
      <Searchbar size="sm" label="Search" placeholder="Small" onSearch={value => console.log('Search:', value)} />
      <Searchbar size="md" label="Search" placeholder="Medium" onSearch={value => console.log('Search:', value)} />
      <Searchbar
        size="default"
        label="Search"
        placeholder="Default"
        onSearch={value => console.log('Search:', value)}
      />
      <Searchbar size="lg" label="Search" placeholder="Large" onSearch={value => console.log('Search:', value)} />
    </div>
  ),
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <div className="bg-surface1 p-4 rounded-lg border border-border1">
        <Searchbar label="Search" placeholder="On bg-surface1" onSearch={value => console.log('Search:', value)} />
      </div>
      <div className="bg-surface2 p-4 rounded-lg border border-border1">
        <Searchbar label="Search" placeholder="On bg-surface2" onSearch={value => console.log('Search:', value)} />
      </div>
      <div className="bg-surface3 p-4 rounded-lg border border-border1">
        <Searchbar label="Search" placeholder="On bg-surface3" onSearch={value => console.log('Search:', value)} />
      </div>
      <div className="bg-surface4 p-4 rounded-lg border border-border1">
        <Searchbar label="Search" placeholder="On bg-surface4" onSearch={value => console.log('Search:', value)} />
      </div>
    </div>
  ),
};

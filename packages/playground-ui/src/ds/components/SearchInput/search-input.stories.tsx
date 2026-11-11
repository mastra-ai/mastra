import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SearchInput } from './search-input';
import type { SearchInputProps } from './search-input';
import { Button } from '@/ds/components/Button';

const meta: Meta<typeof SearchInput> = {
  title: 'Forms/SearchInput',
  component: SearchInput,
  parameters: { layout: 'centered' },
  args: {
    label: 'Search spans',
    placeholder: 'Search spans',
  },
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

function ControlledSearch(props: Pick<SearchInputProps, 'label' | 'placeholder' | 'size'>) {
  const [value, setValue] = useState('');

  return (
    <div className="w-80">
      <SearchInput {...props} value={value} onValueChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: args => <ControlledSearch {...args} />,
};

export const Small: Story = {
  args: { size: 'sm' },
  render: args => <ControlledSearch {...args} />,
};

function CollapsibleSearch(props: Pick<SearchInputProps, 'label' | 'placeholder'>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Search code</Button>;
  }

  return (
    <div className="w-80">
      <SearchInput
        {...props}
        size="sm"
        value={value}
        onValueChange={setValue}
        onClose={() => setOpen(false)}
        autoFocus
      />
    </div>
  );
}

export const Collapsible: Story = {
  args: { label: 'Search code', placeholder: 'Search' },
  render: args => <CollapsibleSearch {...args} />,
};

/** A list page's search: keeps its own text, reports it after a pause, and Cmd/Ctrl+Shift+F focuses it. */
function ListPageSearch(props: Pick<SearchInputProps, 'label' | 'placeholder'>) {
  const [search, setSearch] = useState('');

  return (
    <div className="grid w-80 gap-2">
      <SearchInput {...props} size="sm" debounceMs={300} shortcut onValueChange={setSearch} />
      <p className="text-caption text-muted-foreground">Searching for: {search || '(nothing)'}</p>
    </div>
  );
}

export const ListPage: Story = {
  args: { label: 'Search agents', placeholder: 'Search by name or instructions' },
  render: args => <ListPageSearch {...args} />,
};

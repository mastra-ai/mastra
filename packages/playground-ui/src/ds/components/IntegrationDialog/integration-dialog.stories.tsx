import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { integrationsCatalog } from './__fixtures__/integrations-catalog';
import { IntegrationDialog } from './integration-dialog';
import type { IntegrationDialogItem } from './integration-dialog';
import { Button } from '@/ds/components/Button';

const integrations = integrationsCatalog;

function Example({ items = integrations }: { items?: IntegrationDialogItem[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <IntegrationDialog
        open={open}
        onOpenChange={setOpen}
        title="Add connection"
        description="Choose an integration to authorize."
        items={items}
        onSelect={item => {
          setSelected(item.name);
          setOpen(false);
        }}
      >
        <IntegrationDialog.Trigger render={<Button>Add connection</Button>} />
      </IntegrationDialog>
      <p role="status" className="text-ui-sm text-neutral4">
        {selected ? `Selected ${selected}.` : 'Nothing selected.'}
      </p>
    </div>
  );
}

const meta = {
  title: 'Feedback/IntegrationDialog',
  component: Example,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Searchable integration picker built on the Dialog "new" variant, mirroring the Platform "Add connection" dialog. Search stays fixed under the header and the list scrolls inside the fading Body. Items carry an id, name, optional logo, a badge shown next to the name, muted meta text on the right, and a disabled flag. Consumers own any vendor mapping (for example Nango auth types to labels). The Default story uses a snapshot of the integrations.mastra.ai catalog with its Nango logos. Selection is left to the caller.',
      },
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewItems: Story = { args: { items: integrations.slice(0, 3) } };

export const NoLogos: Story = { args: { items: integrations.slice(0, 4).map(({ logo: _logo, ...item }) => item) } };

export const DisabledItem: Story = {
  args: { items: integrations.slice(0, 4).map(item => (item.id === 'clerk' ? { ...item, disabled: true } : item)) },
};

export const Empty: Story = { args: { items: [] } };

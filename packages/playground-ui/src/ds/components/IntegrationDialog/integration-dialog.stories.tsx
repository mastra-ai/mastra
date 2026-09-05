import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { integrationsCatalog } from './__fixtures__/integrations-catalog';
import { IntegrationDialog } from './integration-dialog';
import type { IntegrationDialogItem } from './integration-dialog';
import { Button } from '@/ds/components/Button';

const integrations: IntegrationDialogItem[] = integrationsCatalog.integrations.map(entry => ({
  id: entry.id,
  name: entry.displayName,
  logo: entry.logoUrl ? <img src={entry.logoUrl} alt="" /> : undefined,
}));

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
          'Searchable integration picker built on DialogNew, mirroring the Platform "Add connection" dialog. Search stays fixed under the header and the list scrolls inside the fading Body. Items carry an id, name, optional logo, badge and disabled flag; a parenthesized suffix in the name such as "Render (MCP)" becomes a badge. The Default story uses a snapshot of the integrations.mastra.ai catalog with its Nango logos. Selection is left to the caller.',
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

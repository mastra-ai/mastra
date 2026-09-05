import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IntegrationDialog } from './integration-dialog';
import type { IntegrationDialogItem } from './integration-dialog';
import { Button } from '@/ds/components/Button';

function logo(slug: string) {
  return <img src={`https://thesvg.org/icons/${slug}/mono.svg`} alt="" className="brightness-0 dark:invert" />;
}

const integrations: IntegrationDialogItem[] = [
  { id: 'anthropic', name: 'Anthropic', logo: logo('anthropic') },
  { id: 'clerk', name: 'Clerk', logo: logo('clerk') },
  { id: 'cloudflare', name: 'Cloudflare', logo: logo('cloudflare') },
  { id: 'github', name: 'GitHub', logo: logo('github') },
  { id: 'gitlab', name: 'GitLab', logo: logo('gitlab') },
  { id: 'hubspot', name: 'HubSpot', logo: logo('hubspot') },
  { id: 'linear', name: 'Linear', logo: logo('linear') },
  { id: 'notion', name: 'Notion', logo: logo('notion') },
  { id: 'stripe', name: 'Stripe', logo: logo('stripe') },
];

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
          'Searchable integration picker built on DialogNew. Mirrors the Platform "Add connection" dialog: search stays fixed under the header and the list scrolls inside the fading Body. Items carry an id, name, optional description and logo; selection is left to the caller.',
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

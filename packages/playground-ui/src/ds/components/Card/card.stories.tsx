import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../Badge';
import { Button } from '../Button';
import { SectionCard } from '../SectionCard';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardInset, CardLink, CardTitle } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: {
    elevation: 'raised',
    interactive: false,
  },
  argTypes: {
    elevation: { control: 'inline-radio', options: ['flat', 'raised'] },
    interactive: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: args => (
    <Card {...args} className="w-[min(24rem,calc(100vw-2rem))]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Research agent</CardTitle>
          <Badge variant="success">Active</Badge>
        </div>
        <CardDescription>Searches trusted sources and returns a cited summary.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-caption text-muted-foreground">Last run completed 4 minutes ago with 12 sources.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="primary">Open agent</Button>
        <Button variant="ghost">Configure</Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevation: Story = {
  render: () => (
    <div className="grid w-[min(44rem,calc(100vw-2rem))] grid-cols-1 gap-5 sm:grid-cols-2">
      {(['flat', 'raised'] as const).map(elevation => (
        <Card key={elevation} elevation={elevation}>
          <CardHeader>
            <CardTitle className="capitalize">{elevation}</CardTitle>
            <CardDescription>
              {elevation === 'raised' ? 'Rim and shadow from shadow-raised' : 'Nested inside another raised surface'}
            </CardDescription>
          </CardHeader>
          <CardContent density="compact">
            <p className="text-caption text-muted-foreground">Card content</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

export const InteractiveLinks: Story = {
  render: () => (
    <div className="grid w-[min(24rem,calc(100vw-2rem))] gap-3">
      <Card interactive onClick={() => undefined}>
        <CardContent>
          <CardTitle>Button card</CardTitle>
          <CardDescription className="mt-1">Keyboard-focusable and pressable.</CardDescription>
        </CardContent>
      </Card>
      <CardLink href="#agent" onClick={event => event.preventDefault()}>
        <CardContent>
          <CardTitle>Link card</CardTitle>
          <CardDescription className="mt-1">Keeps native link semantics.</CardDescription>
        </CardContent>
      </CardLink>
    </div>
  ),
};

const insetRows = [
  { label: 'Source', value: 'Acme Linear' },
  { label: 'Schedule', value: 'Daily at 03:00 UTC' },
  { label: 'Enrich pages', description: 'Relates new pages to ones already in Knowledge', value: 'On' },
];

function InsetRows() {
  return (
    <CardInset>
      {insetRows.map(row => (
        <div key={row.label} className="flex items-center justify-between gap-4 p-3">
          <div className="min-w-0">
            <p className="text-body-sm text-foreground">{row.label}</p>
            {row.description ? <p className="text-caption text-muted-foreground">{row.description}</p> : null}
          </div>
          <span className="shrink-0 text-body-sm text-muted-foreground">{row.value}</span>
        </div>
      ))}
    </CardInset>
  );
}

export const Inset: Story = {
  render: args => (
    <div className="grid w-[min(32rem,calc(100vw-2rem))] gap-6">
      <Card {...args}>
        <CardHeader className="pt-3">
          <CardTitle>Add importer</CardTitle>
          <CardDescription>
            Syncs a connection's documents into Knowledge as pages your agents can read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InsetRows />
        </CardContent>
      </Card>
      <SectionCard title="Importer" description="Settings for the Acme Linear importer">
        <InsetRows />
      </SectionCard>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardLink, CardTitle } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: {
    appearance: 'outlined',
    elevation: 'flat',
    interactive: false,
  },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['outlined', 'surface'] },
    elevation: { control: 'inline-radio', options: ['flat', 'raised', 'elevated'] },
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
          <Badge variant="green">Active</Badge>
        </div>
        <CardDescription>Searches trusted sources and returns a cited summary.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-ui-sm text-neutral4">Last run completed 4 minutes ago with 12 sources.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="primary">Open agent</Button>
        <Button variant="ghost">Configure</Button>
      </CardFooter>
    </Card>
  ),
};

export const AppearancesAndElevation: Story = {
  render: () => (
    <div className="grid w-[min(44rem,calc(100vw-2rem))] grid-cols-1 gap-5 sm:grid-cols-2">
      {(['outlined', 'surface'] as const).flatMap(appearance =>
        (['flat', 'raised', 'elevated'] as const).map(elevation => (
          <Card key={`${appearance}-${elevation}`} appearance={appearance} elevation={elevation}>
            <CardHeader>
              <CardTitle className="capitalize">{elevation}</CardTitle>
              <CardDescription>{appearance} appearance</CardDescription>
            </CardHeader>
            <CardContent density="compact">
              <p className="text-ui-sm text-neutral4">Card content</p>
            </CardContent>
          </Card>
        )),
      )}
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

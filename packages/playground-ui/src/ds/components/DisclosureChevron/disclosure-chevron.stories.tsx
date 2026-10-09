import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../Collapsible';
import { DropdownMenu } from '../DropdownMenu';
import { DisclosureChevron } from './disclosure-chevron';

const meta: Meta<typeof DisclosureChevron> = {
  title: 'Elements/DisclosureChevron',
  component: DisclosureChevron,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    direction: {
      control: { type: 'select' },
      options: ['down', 'up', 'right'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DisclosureChevron>;

export const InMenuTrigger: Story = {
  args: { direction: 'down' },
  render: args => (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button>
            Options
            <DisclosureChevron {...args} />
          </Button>
        }
      />
      <DropdownMenu.Content>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

export const InCollapsibleTrigger: Story = {
  args: { direction: 'right' },
  render: args => (
    <Collapsible className="w-80">
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 text-body-sm text-foreground">
        <DisclosureChevron {...args} className="size-4 text-muted-foreground" />
        Advanced settings
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="py-2 text-body-sm text-muted-foreground">The chevron turns while the section is open.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

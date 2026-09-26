import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown } from 'lucide-react';
import { Button } from '../Button';
import { ScrollArea } from '../ScrollArea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

const meta: Meta<typeof Collapsible> = {
  title: 'Layout/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-88">
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between">
          Click to expand
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border border-border bg-background p-4">
        <p className="text-body text-foreground">This is the collapsible content. It can contain any elements.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-88">
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between">
          Section Title
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border border-border bg-background p-4">
        <p className="text-body text-foreground">This section is open by default.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const SettingsSection: Story = {
  render: () => (
    <div className="w-100 space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between py-2 text-subheading text-foreground hover:text-white">
            Advanced Settings
            <ChevronDown className="size-4" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Debug mode</span>
            <span className="text-body text-muted-foreground">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Verbose logging</span>
            <span className="text-body text-muted-foreground">Off</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-foreground">Cache timeout</span>
            <span className="text-body text-muted-foreground">300s</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const MultipleCollapsibles: Story = {
  render: () => (
    <div className="w-88 space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 1
            <ChevronDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 1</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 2
            <ChevronDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 2</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 3
            <ChevronDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-body text-foreground">Content for section 3</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const FillsConstrainedPanel: Story = {
  render: () => (
    <Collapsible
      defaultOpen
      className="flex h-64 w-88 flex-col overflow-hidden rounded-md border border-border bg-background"
    >
      <CollapsibleTrigger className="flex w-full shrink-0 items-center justify-between px-4 py-2 text-subheading text-foreground">
        Recent runs
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent fill className="flex min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1 border-t border-border">
          <ul className="divide-y divide-border">
            {Array.from({ length: 20 }, (_, index) => (
              <li key={index} className="px-4 py-2 text-body text-foreground">
                Run {index + 1}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  ),
};

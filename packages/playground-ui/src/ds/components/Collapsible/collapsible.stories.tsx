import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
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
    <Collapsible className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Click to expand
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border bg-background mt-2 rounded-md border p-4">
        <p className="text-foreground text-body">This is the collapsible content. It can contain any elements.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Section Title
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border bg-background mt-2 rounded-md border p-4">
        <p className="text-foreground text-body">This section is open by default.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const SettingsSection: Story = {
  render: () => (
    <div className="w-100 space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="text-foreground text-subheading flex w-full items-center justify-between py-2 hover:text-white">
            Advanced Settings
            <ChevronDown className="size-4" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-body">Debug mode</span>
            <span className="text-muted-foreground text-body">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-body">Verbose logging</span>
            <span className="text-muted-foreground text-body">Off</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-body">Cache timeout</span>
            <span className="text-muted-foreground text-body">300s</span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const MultipleCollapsibles: Story = {
  render: () => (
    <div className="w-[350px] space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 1
            <ChevronDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-foreground text-body">Content for section 1</p>
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
          <p className="text-foreground text-body">Content for section 2</p>
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
          <p className="text-foreground text-body">Content for section 3</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

export const FillsConstrainedPanel: Story = {
  render: () => (
    <Collapsible
      defaultOpen
      className="border-border bg-background flex h-64 w-[350px] flex-col overflow-hidden rounded-md border"
    >
      <CollapsibleTrigger className="text-foreground text-subheading flex w-full shrink-0 items-center justify-between px-4 py-2">
        Recent runs
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent fill className="flex min-h-0 flex-col">
        <ScrollArea className="border-border min-h-0 flex-1 border-t">
          <ul className="divide-border divide-y">
            {Array.from({ length: 20 }, (_, index) => (
              <li key={index} className="text-foreground text-body px-4 py-2">
                Run {index + 1}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  ),
};

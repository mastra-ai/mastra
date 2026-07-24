import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
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
      <CollapsibleContent className="border-border1 bg-surface2 mt-2 rounded-md border p-4">
        <p className="text-neutral5 text-sm">This is the collapsible content. It can contain any elements.</p>
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
      <CollapsibleContent className="border-border1 bg-surface2 mt-2 rounded-md border p-4">
        <p className="text-neutral5 text-sm">This section is open by default.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const SettingsSection: Story = {
  render: () => (
    <div className="w-100 space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="text-neutral6 flex w-full items-center justify-between py-2 text-sm font-medium hover:text-white">
            Advanced Settings
            <ChevronDown className="size-4" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-neutral5 text-sm">Debug mode</span>
            <span className="text-neutral3 text-sm">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral5 text-sm">Verbose logging</span>
            <span className="text-neutral3 text-sm">Off</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral5 text-sm">Cache timeout</span>
            <span className="text-neutral3 text-sm">300s</span>
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
          <p className="text-neutral5 text-sm">Content for section 1</p>
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
          <p className="text-neutral5 text-sm">Content for section 2</p>
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
          <p className="text-neutral5 text-sm">Content for section 3</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

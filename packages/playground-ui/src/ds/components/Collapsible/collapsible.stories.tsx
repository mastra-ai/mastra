import type { Meta, StoryObj } from '@storybook/react-vite';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { Button } from '../Button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const meta: Meta<typeof Collapsible> = {
  title: 'Layout/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Click to expand
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-4 rounded-md border border-border1 bg-surface2">
        <p className="text-sm text-neutral5">This is the collapsible content. It can contain any elements.</p>
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
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-4 rounded-md border border-border1 bg-surface2">
        <p className="text-sm text-neutral5">This section is open by default.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const SettingsSection: Story = {
  render: () => (
    <div className="w-[400px] space-y-2">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between py-2 text-sm font-medium text-neutral6 hover:text-white">
            Advanced Settings
            <ChevronDown className="h-4 w-4" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral5">Debug mode</span>
            <span className="text-sm text-neutral3">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral5">Verbose logging</span>
            <span className="text-sm text-neutral3">Off</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral5">Cache timeout</span>
            <span className="text-sm text-neutral3">300s</span>
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
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-sm text-neutral5">Content for section 1</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 2
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-sm text-neutral5">Content for section 2</p>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Section 3
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2">
          <p className="text-sm text-neutral5">Content for section 3</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

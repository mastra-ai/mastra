import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button } from '../Button';
import { Section } from './section';

const meta: Meta<typeof Section> = {
  title: 'Layout/Section',
  component: Section,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: () => (
    <Section className="w-125">
      <Section.Header>
        <Section.Heading>Section Title</Section.Heading>
      </Section.Header>
      <div className="border-border1 bg-surface2 rounded-md border p-4">
        <p className="text-neutral5 text-sm">Section content goes here</p>
      </div>
    </Section>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Section className="w-125">
      <Section.Header>
        <Section.Heading>Agents</Section.Heading>
        <Button size="md">
          <Plus className="size-4" />
          Add Agent
        </Button>
      </Section.Header>
      <div className="border-border1 bg-surface2 rounded-md border p-4">
        <p className="text-neutral5 text-sm">List of agents would go here</p>
      </div>
    </Section>
  ),
};

export const ConfigurationSection: Story = {
  render: () => (
    <Section className="w-125">
      <Section.Header>
        <Section.Heading>Configuration</Section.Heading>
        <Button variant="outline" size="md">
          Edit
        </Button>
      </Section.Header>
      <div className="border-border1 bg-surface2 space-y-3 rounded-md border p-4">
        <div className="flex justify-between">
          <span className="text-neutral3 text-sm">Model</span>
          <span className="text-neutral6 text-sm">GPT-4</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral3 text-sm">Temperature</span>
          <span className="text-neutral6 text-sm">0.7</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral3 text-sm">Max Tokens</span>
          <span className="text-neutral6 text-sm">4096</span>
        </div>
      </div>
    </Section>
  ),
};

export const MultipleSections: Story = {
  render: () => (
    <div className="w-125 space-y-8">
      <Section>
        <Section.Header>
          <Section.Heading>General</Section.Heading>
        </Section.Header>
        <div className="border-border1 bg-surface2 rounded-md border p-4">
          <p className="text-neutral5 text-sm">General settings content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Advanced</Section.Heading>
        </Section.Header>
        <div className="border-border1 bg-surface2 rounded-md border p-4">
          <p className="text-neutral5 text-sm">Advanced settings content</p>
        </div>
      </Section>
    </div>
  ),
};

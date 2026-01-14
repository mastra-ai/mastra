import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from './section';
import { Button } from '../Button';
import { Plus } from 'lucide-react';

const meta: Meta<typeof Section> = {
  title: 'Layout/Section',
  component: Section,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: () => (
    <Section className="w-[500px]">
      <Section.Header>
        <Section.Heading>Section Title</Section.Heading>
      </Section.Header>
      <div className="p-4 rounded-md border border-border1 bg-surface2">
        <p className="text-sm text-icon5">Section content goes here</p>
      </div>
    </Section>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Section className="w-[500px]">
      <Section.Header>
        <Section.Heading>Agents</Section.Heading>
        <Button size="md">
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>
      </Section.Header>
      <div className="p-4 rounded-md border border-border1 bg-surface2">
        <p className="text-sm text-icon5">List of agents would go here</p>
      </div>
    </Section>
  ),
};

export const ConfigurationSection: Story = {
  render: () => (
    <Section className="w-[500px]">
      <Section.Header>
        <Section.Heading>Configuration</Section.Heading>
        <Button variant="outline" size="md">
          Edit
        </Button>
      </Section.Header>
      <div className="space-y-3 p-4 rounded-md border border-border1 bg-surface2">
        <div className="flex justify-between">
          <span className="text-sm text-icon3">Model</span>
          <span className="text-sm text-icon6">GPT-4</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-icon3">Temperature</span>
          <span className="text-sm text-icon6">0.7</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-icon3">Max Tokens</span>
          <span className="text-sm text-icon6">4096</span>
        </div>
      </div>
    </Section>
  ),
};

export const MultipleSections: Story = {
  render: () => (
    <div className="w-[500px] space-y-8">
      <Section>
        <Section.Header>
          <Section.Heading>General</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-border1 bg-surface2">
          <p className="text-sm text-icon5">General settings content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Advanced</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-border1 bg-surface2">
          <p className="text-sm text-icon5">Advanced settings content</p>
        </div>
      </Section>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sections } from './sections';
import { Section } from '../Section';
import { Button } from '../Button';

const meta: Meta<typeof Sections> = {
  title: 'Layout/Sections',
  component: Sections,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Sections>;

export const Default: Story = {
  render: () => (
    <Sections className="w-[500px]">
      <Section>
        <Section.Header>
          <Section.Heading>Section One</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-border1 bg-surface2">
          <p className="text-sm text-icon5">First section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Two</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-border1 bg-surface2">
          <p className="text-sm text-icon5">Second section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Three</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-border1 bg-surface2">
          <p className="text-sm text-icon5">Third section content</p>
        </div>
      </Section>
    </Sections>
  ),
};

export const SettingsPage: Story = {
  render: () => (
    <Sections className="w-[600px]">
      <Section>
        <Section.Header>
          <Section.Heading>Profile</Section.Heading>
          <Button variant="outline" size="md">
            Edit
          </Button>
        </Section.Header>
        <div className="space-y-3 p-4 rounded-md border border-border1 bg-surface2">
          <div className="flex justify-between">
            <span className="text-sm text-icon3">Name</span>
            <span className="text-sm text-icon6">John Doe</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-icon3">Email</span>
            <span className="text-sm text-icon6">john@example.com</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Notifications</Section.Heading>
        </Section.Header>
        <div className="space-y-3 p-4 rounded-md border border-border1 bg-surface2">
          <div className="flex justify-between">
            <span className="text-sm text-icon3">Email notifications</span>
            <span className="text-sm text-icon6">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-icon3">Push notifications</span>
            <span className="text-sm text-icon6">Disabled</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Danger Zone</Section.Heading>
        </Section.Header>
        <div className="p-4 rounded-md border border-red-900 bg-red-900/10">
          <p className="text-sm text-red-400">Irreversible actions that affect your account</p>
        </div>
      </Section>
    </Sections>
  ),
};

export const DocumentationSections: Story = {
  render: () => (
    <Sections className="w-[600px]">
      <Section>
        <Section.Header>
          <Section.Heading>Overview</Section.Heading>
        </Section.Header>
        <p className="text-sm text-icon5">This section provides an overview of the feature and its capabilities.</p>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Installation</Section.Heading>
        </Section.Header>
        <pre className="p-4 rounded-md bg-surface2 text-sm font-mono text-icon5 overflow-x-auto">
          npm install @mastra/core
        </pre>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Usage</Section.Heading>
        </Section.Header>
        <pre className="p-4 rounded-md bg-surface2 text-sm font-mono text-icon5 overflow-x-auto">
          {`import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  // configuration
});`}
        </pre>
      </Section>
    </Sections>
  ),
};

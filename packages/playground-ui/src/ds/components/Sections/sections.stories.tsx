import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Section } from '../Section';
import { Sections } from './sections';

const meta: Meta<typeof Sections> = {
  title: 'Layout/Sections',
  component: Sections,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Sections>;

export const Default: Story = {
  render: () => (
    <Sections className="w-125">
      <Section>
        <Section.Header>
          <Section.Heading>Section One</Section.Heading>
        </Section.Header>
        <div className="bg-surface-secondary rounded-md border border-(--border-subtle) p-4">
          <p className="text-sm text-(--text-primary)">First section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Two</Section.Heading>
        </Section.Header>
        <div className="bg-surface-secondary rounded-md border border-(--border-subtle) p-4">
          <p className="text-sm text-(--text-primary)">Second section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Three</Section.Heading>
        </Section.Header>
        <div className="bg-surface-secondary rounded-md border border-(--border-subtle) p-4">
          <p className="text-sm text-(--text-primary)">Third section content</p>
        </div>
      </Section>
    </Sections>
  ),
};

export const SettingsPage: Story = {
  render: () => (
    <Sections className="w-150">
      <Section>
        <Section.Header>
          <Section.Heading>Profile</Section.Heading>
          <Button variant="outline" size="md">
            Edit
          </Button>
        </Section.Header>
        <div className="bg-surface-secondary space-y-3 rounded-md border border-(--border-subtle) p-4">
          <div className="flex justify-between">
            <span className="text-sm text-(--text-secondary)">Name</span>
            <span className="text-sm text-(--text-primary)">John Doe</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-(--text-secondary)">Email</span>
            <span className="text-sm text-(--text-primary)">john@example.com</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Notifications</Section.Heading>
        </Section.Header>
        <div className="bg-surface-secondary space-y-3 rounded-md border border-(--border-subtle) p-4">
          <div className="flex justify-between">
            <span className="text-sm text-(--text-secondary)">Email notifications</span>
            <span className="text-sm text-(--text-primary)">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-(--text-secondary)">Push notifications</span>
            <span className="text-sm text-(--text-primary)">Disabled</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Danger Zone</Section.Heading>
        </Section.Header>
        <div className="border-red-4 bg-fill-error rounded-md border p-4">
          <p className="text-error text-sm">Irreversible actions that affect your account</p>
        </div>
      </Section>
    </Sections>
  ),
};

export const DocumentationSections: Story = {
  render: () => (
    <Sections className="w-150">
      <Section>
        <Section.Header>
          <Section.Heading>Overview</Section.Heading>
        </Section.Header>
        <p className="text-sm text-(--text-primary)">
          This section provides an overview of the feature and its capabilities.
        </p>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Installation</Section.Heading>
        </Section.Header>
        <pre className="bg-surface-secondary overflow-x-auto rounded-md p-4 font-mono text-sm text-(--text-primary)">
          npm install @mastra/core
        </pre>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Usage</Section.Heading>
        </Section.Header>
        <pre className="bg-surface-secondary overflow-x-auto rounded-md p-4 font-mono text-sm text-(--text-primary)">
          {`import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  // configuration
});`}
        </pre>
      </Section>
    </Sections>
  ),
};

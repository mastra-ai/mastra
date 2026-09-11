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
        <div className="border-border1 bg-surface2 rounded-md border p-4">
          <p className="text-neutral5 text-ui-md">First section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Two</Section.Heading>
        </Section.Header>
        <div className="border-border1 bg-surface2 rounded-md border p-4">
          <p className="text-neutral5 text-ui-md">Second section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Three</Section.Heading>
        </Section.Header>
        <div className="border-border1 bg-surface2 rounded-md border p-4">
          <p className="text-neutral5 text-ui-md">Third section content</p>
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
        <div className="border-border1 bg-surface2 space-y-3 rounded-md border p-4">
          <div className="flex justify-between">
            <span className="text-neutral3 text-ui-md">Name</span>
            <span className="text-neutral6 text-ui-md">John Doe</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral3 text-ui-md">Email</span>
            <span className="text-neutral6 text-ui-md">john@example.com</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Notifications</Section.Heading>
        </Section.Header>
        <div className="border-border1 bg-surface2 space-y-3 rounded-md border p-4">
          <div className="flex justify-between">
            <span className="text-neutral3 text-ui-md">Email notifications</span>
            <span className="text-neutral6 text-ui-md">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral3 text-ui-md">Push notifications</span>
            <span className="text-neutral6 text-ui-md">Disabled</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Danger Zone</Section.Heading>
        </Section.Header>
        <div className="rounded-md border border-red-900 bg-red-900/10 p-4">
          <p className="text-ui-md text-red-400">Irreversible actions that affect your account</p>
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
        <p className="text-neutral5 text-ui-md">
          This section provides an overview of the feature and its capabilities.
        </p>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Installation</Section.Heading>
        </Section.Header>
        <pre className="bg-surface2 text-neutral5 text-ui-md overflow-x-auto rounded-md p-4 font-mono">
          npm install @mastra/core
        </pre>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Usage</Section.Heading>
        </Section.Header>
        <pre className="bg-surface2 text-neutral5 text-ui-md overflow-x-auto rounded-md p-4 font-mono">
          {`import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  // configuration
});`}
        </pre>
      </Section>
    </Sections>
  ),
};

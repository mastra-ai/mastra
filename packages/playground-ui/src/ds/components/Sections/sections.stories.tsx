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
        <div className="border-gray-alpha-3 bg-background-2 rounded-md border p-4">
          <p className="text-gray-10 text-sm">First section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Two</Section.Heading>
        </Section.Header>
        <div className="border-gray-alpha-3 bg-background-2 rounded-md border p-4">
          <p className="text-gray-10 text-sm">Second section content</p>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Section Three</Section.Heading>
        </Section.Header>
        <div className="border-gray-alpha-3 bg-background-2 rounded-md border p-4">
          <p className="text-gray-10 text-sm">Third section content</p>
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
        <div className="border-gray-alpha-3 bg-background-2 space-y-3 rounded-md border p-4">
          <div className="flex justify-between">
            <span className="text-gray-9 text-sm">Name</span>
            <span className="text-gray-10 text-sm">John Doe</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-9 text-sm">Email</span>
            <span className="text-gray-10 text-sm">john@example.com</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Notifications</Section.Heading>
        </Section.Header>
        <div className="border-gray-alpha-3 bg-background-2 space-y-3 rounded-md border p-4">
          <div className="flex justify-between">
            <span className="text-gray-9 text-sm">Email notifications</span>
            <span className="text-gray-10 text-sm">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-9 text-sm">Push notifications</span>
            <span className="text-gray-10 text-sm">Disabled</span>
          </div>
        </div>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Danger Zone</Section.Heading>
        </Section.Header>
        <div className="border-red-4 bg-red-1 rounded-md border p-4">
          <p className="text-red-9 text-sm">Irreversible actions that affect your account</p>
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
        <p className="text-gray-10 text-sm">This section provides an overview of the feature and its capabilities.</p>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Installation</Section.Heading>
        </Section.Header>
        <pre className="bg-background-2 text-gray-10 overflow-x-auto rounded-md p-4 font-mono text-sm">
          npm install @mastra/core
        </pre>
      </Section>
      <Section>
        <Section.Header>
          <Section.Heading>Usage</Section.Heading>
        </Section.Header>
        <pre className="bg-background-2 text-gray-10 overflow-x-auto rounded-md p-4 font-mono text-sm">
          {`import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  // configuration
});`}
        </pre>
      </Section>
    </Sections>
  ),
};

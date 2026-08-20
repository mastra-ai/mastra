import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button } from '../Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Switch } from '../Switch';
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

export const Flat: Story = {
  render: () => (
    <Section variant="flat" className="w-full max-w-150">
      <Section.Header>
        <Section.HeaderText>
          <Section.Heading>Security</Section.Heading>
          <Section.Description>Manage sign-in requirements for your account.</Section.Description>
        </Section.HeaderText>
      </Section.Header>
      <Section.Content>
        <Section.Row label="Two-factor authentication" description="Require a verification code when signing in.">
          <Switch aria-label="Two-factor authentication" />
        </Section.Row>
        <Section.Row label="Session timeout" description="Sign out after a period of inactivity." htmlFor="timeout">
          <Select defaultValue="30">
            <SelectTrigger id="timeout" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </Section.Row>
        <Section.Divider />
        <Section.Row label="Active sessions" description="Review devices currently signed in to your account.">
          <Button size="sm" variant="ghost">
            Review
          </Button>
        </Section.Row>
      </Section.Content>
    </Section>
  ),
};

export const Factory: Story = {
  render: () => (
    <Section variant="factory" className="w-full max-w-150">
      <Section.Header>
        <Section.HeaderText>
          <Section.Heading>Behavior</Section.Heading>
          <Section.Description>Choose how agents handle tools and completion alerts.</Section.Description>
        </Section.HeaderText>
      </Section.Header>
      <Section.Content>
        <Section.Row label="Auto-approve tools" description="Run tool calls without asking.">
          <Switch aria-label="Auto-approve tools" />
        </Section.Row>
        <Section.Divider />
        <Section.Row label="Smart editing" description="Use AST-aware edits when available.">
          <Switch aria-label="Smart editing" />
        </Section.Row>
        <Section.Divider />
        <Section.Row
          label="Notifications"
          description="Choose how completion alerts are delivered."
          htmlFor="notifications"
        >
          <Select defaultValue="off">
            <SelectTrigger id="notifications" className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="bell">Bell</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </Section.Row>
      </Section.Content>
    </Section>
  ),
};

export const PermissionAndDestructiveRows: Story = {
  render: () => (
    <Section variant="factory" className="w-full max-w-150">
      <Section.Header>
        <Section.HeaderText>
          <Section.Heading>Organization access</Section.Heading>
          <Section.Description>Review inherited permissions and organization actions.</Section.Description>
        </Section.HeaderText>
      </Section.Header>
      <Section.Content>
        <Section.ViewOnlyRow
          label="Project access"
          description="This permission is inherited from your organization role."
        >
          Viewer
        </Section.ViewOnlyRow>
        <Section.Divider />
        <Section.DestructiveRow
          label="Leave organization"
          description="Remove your access to this organization and its projects."
        >
          <Button variant="destructive-ghost">Leave</Button>
        </Section.DestructiveRow>
      </Section.Content>
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

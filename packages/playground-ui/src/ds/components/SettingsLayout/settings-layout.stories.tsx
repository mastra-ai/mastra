import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Section } from '../Section';
import type { SectionVariant } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Switch } from '../Switch';
import { SettingsLayout } from './settings-layout';

type SettingsLayoutStoryProps = {
  title: string;
  description: string;
  inset: boolean;
  sectionVariant: SectionVariant;
  showAction: boolean;
  variant: 'default' | 'header';
};

function SettingsLayoutStory({
  title,
  description,
  inset,
  sectionVariant,
  showAction,
  variant,
}: SettingsLayoutStoryProps) {
  const content = (
    <Section variant={sectionVariant}>
      <Section.Header inset={inset}>
        <Section.HeaderText>
          <Section.Heading>General</Section.Heading>
          <Section.Description>Stored in this browser.</Section.Description>
        </Section.HeaderText>
      </Section.Header>
      <Section.Content>
        <Section.Row label="Theme" description="Color scheme for the interface" htmlFor="settings-theme">
          <Select defaultValue="system">
            <SelectTrigger id="settings-theme" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Section.Row>
        <Section.Divider />
        <Section.Row label="Completion sound" description="Played when an agent run finishes in a workspace">
          <Switch aria-label="Play completion sound" defaultChecked />
        </Section.Row>
      </Section.Content>
    </Section>
  );

  return (
    <SettingsLayout
      title={title}
      description={description || undefined}
      inset={inset}
      action={showAction ? <Button size="sm">Save changes</Button> : undefined}
      variant={variant}
    >
      {variant === 'header' ? (
        <div className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 sm:px-6 sm:py-8">{content}</div>
      ) : (
        content
      )}
    </SettingsLayout>
  );
}

const meta = {
  title: 'Layout/SettingsLayout',
  component: SettingsLayoutStory,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    title: 'Preferences',
    description: '',
    inset: false,
    sectionVariant: 'factory',
    showAction: false,
    variant: 'default',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    inset: { control: 'boolean' },
    sectionVariant: {
      control: 'select',
      options: ['default', 'flat', 'factory'],
    },
    showAction: { control: 'boolean' },
    variant: {
      control: 'select',
      options: ['default', 'header'],
    },
  },
} satisfies Meta<typeof SettingsLayoutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    description: 'Manage your preferences and workspace defaults.',
    showAction: true,
  },
};

export const InsetWithAction: Story = {
  args: {
    title: 'Project Settings',
    inset: true,
    showAction: true,
  },
};

export const HeaderOnly: Story = {
  args: {
    title: 'Deployment',
    description: 'Studio · Jan 1, 2025 07:00:00 · abcdef1',
    variant: 'header',
  },
};

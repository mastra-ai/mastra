import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Switch } from '../Switch';
import { SettingsLayout } from './settings-layout';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from '@/ds/new/settings';

type SettingsLayoutStoryProps = {
  title: string;
  description: string;
  inset: boolean;
  showAction: boolean;
  showTitleAccessory: boolean;
  variant: 'default' | 'header';
};

function SettingsLayoutStory({
  title,
  description,
  inset,
  showAction,
  showTitleAccessory,
  variant,
}: SettingsLayoutStoryProps) {
  const content = (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>General</SettingsTitle>
        <SettingsDescription>Stored in this browser.</SettingsDescription>
      </SettingsHeader>
      <SettingsContainer>
        <SettingsRow label="Theme" description="Color scheme for the interface" htmlFor="settings-theme">
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
        </SettingsRow>
        <SettingsRow label="Completion sound" description="Played when an agent run finishes in a workspace">
          <Switch aria-label="Play completion sound" defaultChecked />
        </SettingsRow>
      </SettingsContainer>
    </SettingsGroup>
  );

  return (
    <SettingsLayout
      title={title}
      titleAccessory={showTitleAccessory ? <Badge size="sm">Studio</Badge> : undefined}
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
    showAction: false,
    showTitleAccessory: false,
    variant: 'default',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    inset: { control: 'boolean' },
    showAction: { control: 'boolean' },
    showTitleAccessory: { control: 'boolean' },
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
    description: 'Jan 1, 2025 07:00:00 · abcdef1',
    showTitleAccessory: true,
    variant: 'header',
  },
};

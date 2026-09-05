import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Section } from '../Section';
import type { SectionVariant } from '../Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Switch } from '../Switch';
import { SettingsLayout } from './settings-layout';

type SettingsLayoutStoryProps = {
  title: string;
  inset: boolean;
  sectionVariant: SectionVariant;
  showAction: boolean;
};

function SettingsLayoutStory({ title, inset, sectionVariant, showAction }: SettingsLayoutStoryProps) {
  return (
    <SettingsLayout
      title={title}
      inset={inset}
      action={showAction ? <Button size="sm">Save changes</Button> : undefined}
    >
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
    inset: false,
    sectionVariant: 'factory',
    showAction: false,
  },
  argTypes: {
    title: { control: 'text' },
    inset: { control: 'boolean' },
    sectionVariant: {
      control: 'select',
      options: ['default', 'flat', 'factory'],
    },
    showAction: { control: 'boolean' },
  },
} satisfies Meta<typeof SettingsLayoutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InsetWithAction: Story = {
  args: {
    title: 'Project Settings',
    inset: true,
    showAction: true,
  },
};

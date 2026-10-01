import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsContainer, SettingsRow } from './index';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import { Input } from '@/ds/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Switch } from '@/ds/components/Switch';
import { ThemeProvider } from '@/ds/components/ThemeProvider';

const models = [
  { label: 'openai/gpt-6-luna', value: 'openai/gpt-6-luna', description: 'openai' },
  { label: 'google/gemini-3.5-flash', value: 'google/gemini-3.5-flash', description: 'google' },
  {
    label: 'openrouter/anthropic/claude-opus-5-5',
    value: 'openrouter/anthropic/claude-opus-5-5',
    description: 'openrouter',
  },
];

const meta = {
  title: 'New/SettingsRow',
  component: SettingsRow,
  parameters: { layout: 'padded' },
  args: {
    label: 'Observer model',
    description: 'Summarizes the conversation into observations',
  },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-new-settings-row">
        <div className="mx-auto max-w-4xl">
          <SettingsContainer>
            <Story />
          </SettingsContainer>
        </div>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof SettingsRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <SettingsRow {...args}>
      <Combobox options={models} value="google/gemini-3.5-flash" />
    </SettingsRow>
  ),
};

/** Selects and comboboxes beside the label share one width set by the row; other controls keep their own. */
export const Controls: Story = {
  render: () => (
    <>
      <SettingsRow label="Observer model" description="Combobox, sized by the row">
        <Combobox options={models} value="openai/gpt-6-luna" />
      </SettingsRow>
      <SettingsRow label="Reflector model" description="Long values truncate at the row width">
        <Combobox options={models} value="openrouter/anthropic/claude-opus-5-5" />
      </SettingsRow>
      <SettingsRow label="Region" description="Select, sized by the row">
        <Select defaultValue="eu">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu">Europe</SelectItem>
            <SelectItem value="us">United States</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label="Max steps" description="Inputs set their own width">
        <Input className="w-40" defaultValue="5" />
      </SettingsRow>
      <SettingsRow label="Notifications" description="Notify when a run finishes">
        <Switch defaultChecked />
      </SettingsRow>
    </>
  ),
};

/** A width class on the trigger overrides the row, e.g. a compact picker next to an action. */
export const CompactOverride: Story = {
  render: () => (
    <SettingsRow label="Linear team" description="Routes this team's issues to a Factory">
      <div className="flex items-center gap-2">
        <Select defaultValue="mastra">
          <SelectTrigger size="sm" aria-label="Factory for Linear team" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mastra">mastra</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost">
          Remove
        </Button>
      </div>
    </SettingsRow>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <SettingsRow
      label="Factory default model"
      description="Factory runs (triage, board work items) start on this model and use the Factory observational-memory settings below. Your personal defaults don't apply to them."
    >
      <Combobox options={models} value="google/gemini-3.5-flash" />
    </SettingsRow>
  ),
};

export const ViewOnly: Story = {
  render: () => (
    <SettingsRow label="Project access" description="Inherited from your organization role." viewOnly>
      Viewer
    </SettingsRow>
  ),
};

export const Destructive: Story = {
  render: () => (
    <SettingsRow label="Leave organization" description="Remove your access to this organization." tone="destructive">
      <Button variant="destructive-ghost">Leave</Button>
    </SettingsRow>
  ),
};

export const Validation: Story = {
  render: () => (
    <SettingsRow label="Model" required errorMsg="Choose the model this agent runs on.">
      <Input className="w-56" placeholder="openai/gpt-5.2" />
    </SettingsRow>
  ),
};

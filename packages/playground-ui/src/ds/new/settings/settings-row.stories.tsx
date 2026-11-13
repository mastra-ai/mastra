import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsContainer, SettingsControlGroup, SettingsRow } from './index';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/ds/components/InputGroup';
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

/**
 * Several controls that set one value go in a `SettingsControlGroup`, never a `div` with its own width: the group
 * takes the field width, so it ends on the same edge as the controls above and below it. A lone select fills it.
 */
export const ControlGroup: Story = {
  render: () => (
    <>
      <SettingsRow label="Deploy key" description="Adds a Gateway API key to each deploy">
        <Switch aria-label="Deploy key" defaultChecked />
      </SettingsRow>
      <SettingsRow label="Models">
        <Combobox options={models} value="openai/gpt-6-luna" />
      </SettingsRow>
      <SettingsRow label="Spend limit">
        <SettingsControlGroup>
          <Select defaultValue="monthly">
            <SelectTrigger aria-label="Period" className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No limit</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput aria-label="Limit" defaultValue="50" />
          </InputGroup>
        </SettingsControlGroup>
      </SettingsRow>
      <SettingsRow label="Spend limit" description="One control left in the group fills it">
        <SettingsControlGroup>
          <Select defaultValue="none">
            <SelectTrigger aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No limit</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </SettingsControlGroup>
      </SettingsRow>
    </>
  ),
};

/**
 * A setting that is on or off is a `Switch` alone: no "Enabled"/"Disabled" text beside it, since the switch already
 * shows its state. When the viewer can't change it, keep the switch and disable it (`viewOnly` on the row, or
 * `disabled` on the switch), rather than swapping it for text. Text in the control slot is for a status the user
 * doesn't set (a `Badge`), not for a toggle.
 */
export const Toggle: Story = {
  render: () => (
    <>
      <SettingsRow label="Notifications" description="Notify when a run finishes">
        <Switch aria-label="Notifications" defaultChecked />
      </SettingsRow>
      <SettingsRow label="Observability" description="Only admins can change this" viewOnly>
        <Switch aria-label="Observability" defaultChecked />
      </SettingsRow>
    </>
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

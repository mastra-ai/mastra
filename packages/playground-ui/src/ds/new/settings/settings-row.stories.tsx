import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsContainer, SettingsRow } from './index';
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

/** Every control ends on the same edge: selects, comboboxes and inputs fill the row's control column; switches keep their size. */
export const Controls: Story = {
  render: () => (
    <>
      <SettingsRow label="Observer model" description="Combobox, fills the column">
        <Combobox options={models} value="openai/gpt-6-luna" />
      </SettingsRow>
      <SettingsRow label="Reflector model" description="Long values truncate at the column width">
        <Combobox options={models} value="openrouter/anthropic/claude-opus-5-5" />
      </SettingsRow>
      <SettingsRow label="Region" description="Select, fills the column">
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
      <SettingsRow label="Max steps" description="Input, fills the column">
        <Input defaultValue="5" />
      </SettingsRow>
      <SettingsRow label="Notifications" description="Notify when a run finishes">
        <Switch defaultChecked />
      </SettingsRow>
    </>
  ),
};

/** A control and an action in one row: put both straight in the row. The select fills what the button leaves. */
export const WithAction: Story = {
  render: () => (
    <SettingsRow label="Linear team" description="Routes this team's issues to a Factory">
      <Select defaultValue="mastra">
        <SelectTrigger aria-label="Factory for Linear team">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mastra">mastra</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="ghost">Remove</Button>
    </SettingsRow>
  ),
};

/**
 * Several controls that set one value go straight in the row, with no wrapper or widths: they split the control
 * column and end on the same edge as the rows above. A lone select fills it.
 */
export const SeveralControls: Story = {
  render: () => (
    <>
      <SettingsRow label="Deploy key" description="Adds a Gateway API key to each deploy">
        <Switch aria-label="Deploy key" defaultChecked />
      </SettingsRow>
      <SettingsRow label="Models">
        <Combobox options={models} value="openai/gpt-6-luna" />
      </SettingsRow>
      <SettingsRow label="Spend limit">
        <Select defaultValue="monthly">
          <SelectTrigger aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No limit</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>$</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput aria-label="Limit" defaultValue="50" />
        </InputGroup>
      </SettingsRow>
      <SettingsRow label="Spend limit" description="One control left fills the column">
        <Select defaultValue="none">
          <SelectTrigger aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No limit</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
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
      <Input placeholder="openai/gpt-5.2" />
    </SettingsRow>
  ),
};

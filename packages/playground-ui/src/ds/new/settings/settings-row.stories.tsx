import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsContainer, SettingsControl, SettingsRow } from './index';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import { Field, FieldError } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/ds/components/InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@/ds/components/InputNumber';
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
        <div className="mx-auto max-w-160">
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

/**
 * The row sets every field's width, so none needs a width class. Fields you type in (an input, an input group, a
 * number field, a combobox) take one width, also inside a wrapper; a select hugs its value up to that width.
 */
export const FieldWidths: Story = {
  render: () => (
    <>
      <SettingsRow label="Input">
        <Input defaultValue="/api" />
      </SettingsRow>
      <SettingsRow label="Input group">
        <InputGroup>
          <InputGroupInput defaultValue="60" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>/ min</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </SettingsRow>
      <SettingsRow label="Number field">
        <InputNumber defaultValue={30000} min={1} step={1000}>
          <InputNumberGroup>
            <InputNumberInput />
            <InputGroupAddon align="inline-end" variant="flush">
              <InputGroupText className="mr-2">tokens</InputGroupText>
              <InputNumberDecrement />
              <InputNumberIncrement />
            </InputGroupAddon>
          </InputNumberGroup>
        </InputNumber>
      </SettingsRow>
      <SettingsRow label="Combobox">
        <Combobox options={models} value="google/gemini-3.5-flash" />
      </SettingsRow>
      <SettingsRow label="Select">
        <Select defaultValue="eu">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu">Europe</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label="In a field">
        <Field invalid>
          <Input aria-label="In a field" defaultValue="-1" />
          <FieldError>Must be 0 or more.</FieldError>
        </Field>
      </SettingsRow>
      <SettingsRow label="With an action">
        <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={event => event.preventDefault()}>
          <Input aria-label="With an action" defaultValue="Production" />
          <Button type="submit">Save</Button>
        </form>
      </SettingsRow>
      <SettingsRow label="Own width" description="A short number keeps the width it asks for">
        <InputNumber defaultValue={5} className="w-24">
          <InputNumberGroup>
            <InputNumberInput />
          </InputNumberGroup>
        </InputNumber>
      </SettingsRow>
    </>
  ),
};

/** Outside a row, `SettingsControl` gives fields the same widths: here a setting under its own title. */
export const OutsideARow: Story = {
  render: () => (
    <SettingsControl className="flex flex-col gap-2">
      <Input aria-label="Session" defaultValue="default" />
      <Combobox aria-label="Model" options={models} value="google/gemini-3.5-flash" />
    </SettingsControl>
  ),
};

/** Fields take the row's width; switches keep their own, and a width class on a field still wins. */
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
 * Several controls go straight in the row, with no wrapper or width: the row lines them up on its right edge, the
 * same edge as every other row. A select hugs its value; an input group next to it takes the rest of the column.
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
      <SettingsRow label="Spend limit" description="With no limit, only the select">
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

/**
 * Controls too wide to sit beside their label (keeping the label at least 12rem) wrap under it, still on the right
 * edge: here an inline edit with its field and actions. Narrower controls in the same card stay beside their label.
 */
export const WideControl: Story = {
  render: () => (
    <>
      <SettingsRow label="Webhook" description="Receives an event when a deploy finishes.">
        <Input className="w-80" defaultValue="https://hooks.example.com/deploys/acme-production" />
        <Button>Send test</Button>
      </SettingsRow>
      <SettingsRow label="Notifications" description="Notify when a run finishes">
        <Switch defaultChecked />
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

/** A disabled row keeps its label color; only the control looks disabled. */
export const Disabled: Story = {
  render: () => (
    <SettingsRow label="Start on its own" description="Moves the item on when its checks pass." disabled>
      <Switch aria-label="Start on its own" defaultChecked />
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

/** A disabled destructive row keeps its red label. */
export const DestructiveDisabled: Story = {
  render: () => (
    <SettingsRow
      label="Leave organization"
      description="Remove your access to this organization."
      tone="destructive"
      disabled
    >
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

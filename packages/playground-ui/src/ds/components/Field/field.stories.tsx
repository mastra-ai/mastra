import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeEditor } from '../CodeEditor';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Textarea } from '../Textarea';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, Fieldset, FieldsetLegend } from './field';

const meta: Meta<typeof Field> = {
  title: 'Elements/Field',
  component: Field,
  parameters: {
    docs: {
      description: {
        component: `
A label, its control, help text and error, wired together.

**Required and optional fields**

- **Required:** a field the form can't be submitted without gets \`<FieldLabel required>\`: a red asterisk, and \`aria-required\` on the control. Always, also when every field is required or there is only one.
- **Optional:** no mark next to required fields, since no asterisk already means optional. In a form where no label has an asterisk, a field that may stay empty gets \`<FieldLabel optional>\`: a muted "(optional)".
- **Required in some states:** pass the condition (\`required={provider === 'custom'}\`), and the mark follows it. When one of several fields is enough, mark none and say so in a \`FieldDescription\`.
- **Never empty, never marked:** switches, sliders, segmented controls, and selects that start with a value and can't be cleared.
- **Not forms, not marked:** search, filters, toolbar controls, and settings rows that change one existing value.

The mark follows what submitting enforces. Don't write "(optional)" or "(required)" in a label, placeholder or help text, don't set \`aria-required\` yourself, and don't restyle the label.
`,
      },
    },
  },
  decorators: [
    Story => (
      <div className="w-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {
  render: () => (
    <Field>
      <FieldLabel required>Email</FieldLabel>
      <Input type="email" placeholder="ada@example.com" />
      <FieldDescription>Used to sign in to Studio.</FieldDescription>
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field invalid>
      <FieldLabel required>Email</FieldLabel>
      <Input type="email" defaultValue="ada@" />
      <FieldError>Enter a complete email address.</FieldError>
    </Field>
  ),
};

/** A form with required fields: the asterisk marks them, and the field without one is optional. */
export const RequiredFields: Story = {
  render: () => (
    <div className="grid gap-4">
      <Field>
        <FieldLabel required>Name</FieldLabel>
        <Input placeholder="Support agent" />
      </Field>
      <Field>
        <FieldLabel required>Model</FieldLabel>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai/gpt-5.6-sol">openai/gpt-5.6-sol</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea placeholder="Answers billing questions" />
      </Field>
    </div>
  ),
};

/** No field in this form is required, so the one that may stay empty says it's optional. */
export const OptionalField: Story = {
  render: () => (
    <Field>
      <FieldLabel optional>Change message</FieldLabel>
      <Input placeholder="Describe what changed" />
    </Field>
  ),
};

export const WithInfo: Story = {
  render: () => (
    <Field>
      <FieldLabel info="Shown to people who pick this agent. Keep it short.">Display name</FieldLabel>
      <Input placeholder="Support agent" />
    </Field>
  ),
};

export const RequiredWithInfo: Story = {
  render: () => (
    <Field>
      <FieldLabel required info="Runs before every reply. Max 4,000 characters.">
        Instructions
      </FieldLabel>
      <Textarea placeholder="You are a helpful assistant." />
    </Field>
  ),
};

export const DisabledWithInfo: Story = {
  render: () => (
    <Field disabled>
      <FieldLabel info="Set by the agent's code, so it can't be edited here.">Model</FieldLabel>
      <Input defaultValue="openai/gpt-5.6-sol" />
    </Field>
  ),
};

export const HiddenLabel: Story = {
  render: () => (
    <Field>
      <FieldLabel className="sr-only">Search agents</FieldLabel>
      <Input type="search" placeholder="Search agents" />
    </Field>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Field orientation="horizontal" className="items-baseline">
      <FieldLabel className="w-24">Provider</FieldLabel>
      <FieldContent>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
          </SelectContent>
        </Select>
        <FieldDescription>Models load from this provider.</FieldDescription>
      </FieldContent>
    </Field>
  ),
};

export const Textareas: Story = {
  render: () => (
    <Field>
      <FieldLabel>Instructions</FieldLabel>
      <Textarea placeholder="You are a helpful assistant." />
      <FieldDescription>Sent as the system prompt.</FieldDescription>
    </Field>
  ),
};

export const CodeEditors: Story = {
  render: () => (
    <Field invalid>
      <FieldLabel>Payload (JSON)</FieldLabel>
      <CodeEditor value={'{\n  "city": "Paris"\n'} className="h-32" />
      <FieldError>Expected a closing brace.</FieldError>
    </Field>
  ),
};

export const Group: Story = {
  render: () => (
    <Fieldset>
      <FieldsetLegend>Environment variable</FieldsetLegend>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Key</FieldLabel>
          <Input className="font-mono" placeholder="OPENAI_API_KEY" />
        </Field>
        <Field>
          <FieldLabel>Value</FieldLabel>
          <Input className="font-mono" type="password" placeholder="sk-xxxxxxxx" />
        </Field>
      </div>
    </Fieldset>
  ),
};

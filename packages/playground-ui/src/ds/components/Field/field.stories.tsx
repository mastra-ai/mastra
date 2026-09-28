import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeEditor } from '../CodeEditor';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Textarea } from '../Textarea';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, Fieldset, FieldsetLegend } from './field';

const meta: Meta<typeof Field> = {
  title: 'Elements/Field',
  component: Field,
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
    <Field orientation="horizontal">
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
          <Input className="font-mono" type="password" placeholder="sk-…" />
        </Field>
      </div>
    </Fieldset>
  ),
};

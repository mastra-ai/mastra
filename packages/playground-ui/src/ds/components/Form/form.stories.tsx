import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { Field, FieldError, FieldLabel } from '../Field';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Textarea } from '../Textarea';
import { Form } from './form';

const meta: Meta<typeof Form> = {
  title: 'Elements/Form',
  component: Form,
  decorators: [
    Story => (
      <div className="w-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Default: Story = {
  render: () => (
    <Form onSubmit={event => event.preventDefault()}>
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input name="name" placeholder="Support agent" />
      </Field>
      <Field>
        <FieldLabel>Model</FieldLabel>
        <Select name="model" defaultValue="gpt-5">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-5">gpt-5</SelectItem>
            <SelectItem value="claude-sonnet">claude-sonnet</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Instructions</FieldLabel>
        <Textarea name="instructions" placeholder="You are a helpful assistant." />
      </Field>
      <Button type="submit" className="self-start">
        Save
      </Button>
    </Form>
  ),
};

export const RequiredField: Story = {
  render: () => (
    <Form onSubmit={event => event.preventDefault()}>
      <Field>
        <FieldLabel required>Dataset name</FieldLabel>
        <Input name="dataset" required />
        <FieldError />
      </Field>
      <Button type="submit" className="self-start">
        Create dataset
      </Button>
    </Form>
  ),
};

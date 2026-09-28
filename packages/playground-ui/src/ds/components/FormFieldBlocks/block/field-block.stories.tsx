import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldBlock } from './field-block';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Input } from '@/ds/components/Input';

const meta: Meta<typeof FieldBlock> = {
  title: 'FormFieldBlocks/FieldBlock',
  component: FieldBlock,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FieldBlock>;

export const VerticalLayout: Story = {
  name: 'Vertical (Default)',
  render: () => (
    <FieldBlock name="email" label="Email" required helpText="We will never share your email.">
      {control => <Input {...control} placeholder="john@example.com" />}
    </FieldBlock>
  ),
};

export const HorizontalLayout: Story = {
  name: 'Horizontal',
  render: () => (
    <FieldBlock
      name="email"
      label="Email"
      required
      layout="horizontal"
      labelColumnWidth="5rem"
      helpText="We will never share your email."
    >
      {control => <Input {...control} placeholder="john@example.com" />}
    </FieldBlock>
  ),
};

export const HiddenLabel: Story = {
  render: () => (
    <FieldBlock name="search" label="Search agents" labelIsHidden>
      {control => <Input {...control} placeholder="Search agents" />}
    </FieldBlock>
  ),
};

export const WithErrorMsg: Story = {
  name: 'With Error Message',
  render: () => (
    <FieldBlock name="password" label="Password" required errorMsg="Password must be at least 8 characters.">
      {control => <Input {...control} type="password" error />}
    </FieldBlock>
  ),
};

export const AnyControl: Story = {
  render: () => (
    <FieldBlock name="payload" label="Payload (JSON)" helpText="Sent as the request body.">
      {control => <CodeEditor {...control} value={'{\n  "city": "Paris"\n}'} className="h-32" />}
    </FieldBlock>
  ),
};

export const LabelSizes: Story = {
  render: () => (
    <div className="grid gap-6">
      <FieldBlock name="default" label="Default label" labelSize="default">
        {control => <Input {...control} />}
      </FieldBlock>
      <FieldBlock name="bigger" label="Bigger label" labelSize="bigger">
        {control => <Input {...control} />}
      </FieldBlock>
    </div>
  ),
};

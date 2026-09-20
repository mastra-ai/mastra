import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldBlock } from './field-block';
import { Input } from '@/ds/components/Input';

const meta: Meta = {
  title: 'FormFieldBlocks/FieldBlock',
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

export const VerticalLayout: StoryObj = {
  name: 'Vertical (Default)',
  render: () => (
    <FieldBlock.Layout>
      <FieldBlock.Column>
        <FieldBlock.Label name="email" required>
          Email
        </FieldBlock.Label>
        <Input id="input-email" placeholder="john@example.com" />
        <FieldBlock.HelpText>We will never share your email.</FieldBlock.HelpText>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

export const HorizontalLayout: StoryObj = {
  name: 'Horizontal',
  render: () => (
    <FieldBlock.Layout layout="horizontal" labelColumnWidth="5rem">
      <FieldBlock.Column>
        <FieldBlock.Label name="email" required size="bigger">
          Email
        </FieldBlock.Label>
      </FieldBlock.Column>
      <FieldBlock.Column>
        <Input id="input-email" placeholder="john@example.com" />
        <FieldBlock.HelpText>We will never share your email.</FieldBlock.HelpText>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

export const WithErrorMsg: StoryObj = {
  name: 'With Error Message',
  render: () => (
    <FieldBlock.Layout>
      <FieldBlock.Column>
        <FieldBlock.Label name="password" required>
          Password
        </FieldBlock.Label>
        <Input id="input-password" type="password" error aria-describedby="error-password" />
        <FieldBlock.ErrorMsg name="password">Password must be at least 8 characters.</FieldBlock.ErrorMsg>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

export const LabelSizes: StoryObj = {
  render: () => (
    <div className="grid gap-6">
      <FieldBlock.Layout>
        <FieldBlock.Column>
          <FieldBlock.Label name="default" size="default">
            Default label
          </FieldBlock.Label>
          <Input id="input-default" />
        </FieldBlock.Column>
      </FieldBlock.Layout>
      <FieldBlock.Layout>
        <FieldBlock.Column>
          <FieldBlock.Label name="bigger" size="bigger">
            Bigger label
          </FieldBlock.Label>
          <Input id="input-bigger" />
        </FieldBlock.Column>
      </FieldBlock.Layout>
    </div>
  ),
};

export const AllParts: StoryObj = {
  name: 'All Sub-components',
  render: () => (
    <FieldBlock.Layout>
      <FieldBlock.Column>
        <FieldBlock.Label name="username" required>
          Username
        </FieldBlock.Label>
        <Input id="input-username" defaultValue="ab" error aria-describedby="error-username" />
        <FieldBlock.HelpText>Must be 3-20 characters long.</FieldBlock.HelpText>
        <FieldBlock.ErrorMsg name="username">Username is too short.</FieldBlock.ErrorMsg>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

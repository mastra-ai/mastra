import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldBlock } from './field-block';

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
        <input
          id="input-email"
          className="h-9 rounded-md border border-border1 bg-transparent px-3 text-ui-sm text-neutral6"
          placeholder="john@example.com"
        />
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
        <input
          id="input-email"
          className="h-9 rounded-md border border-border1 bg-transparent px-3 text-ui-sm text-neutral6 w-full"
          placeholder="john@example.com"
        />
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
        <input
          id="input-password"
          type="password"
          className="h-9 rounded-md border border-red-400 bg-transparent px-3 text-ui-sm text-neutral6"
        />
        <FieldBlock.ErrorMsg>Password must be at least 8 characters.</FieldBlock.ErrorMsg>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

export const LabelSizes: StoryObj = {
  name: 'Label Sizes',
  render: () => (
    <div className="grid gap-6">
      <FieldBlock.Layout>
        <FieldBlock.Column>
          <FieldBlock.Label name="default" size="default">
            Default label
          </FieldBlock.Label>
          <input
            id="input-default"
            className="h-9 rounded-md border border-border1 bg-transparent px-3 text-ui-sm text-neutral6"
          />
        </FieldBlock.Column>
      </FieldBlock.Layout>
      <FieldBlock.Layout>
        <FieldBlock.Column>
          <FieldBlock.Label name="bigger" size="bigger">
            Bigger label
          </FieldBlock.Label>
          <input
            id="input-bigger"
            className="h-9 rounded-md border border-border1 bg-transparent px-3 text-ui-sm text-neutral6"
          />
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
        <input
          id="input-username"
          className="h-9 rounded-md border border-red-400 bg-transparent px-3 text-ui-sm text-neutral6"
          defaultValue="ab"
        />
        <FieldBlock.HelpText>Must be 3-20 characters long.</FieldBlock.HelpText>
        <FieldBlock.ErrorMsg>Username is too short.</FieldBlock.ErrorMsg>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  ),
};

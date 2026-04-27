import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, AlertTitle, AlertDescription } from './Alert';

/**
 * @deprecated `<Alert>` is kept as a thin wrapper over `<Notice>` for backwards
 * compatibility. New code should use `<Notice>` directly — see the Notice stories.
 */
const meta: Meta<typeof Alert> = {
  title: 'Elements/Alert (deprecated)',
  component: Alert,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '**Deprecated.** Use `<Notice>` instead. This component now renders a `<Notice>` under the hood and will be removed in a future major release.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['warning', 'destructive', 'info'],
    },
  },
  decorators: [
    Story => (
      <div className="bg-surface2 rounded-lg p-6" style={{ width: 800 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: {
    variant: 'destructive',
    children: 'This is an alert message',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'This is a warning alert',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'This is a destructive alert',
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'This is an info alert',
  },
};

export const WithTitleAndDescription: Story = {
  render: args => (
    <Alert {...args}>
      <AlertTitle>Alert Title</AlertTitle>
      <AlertDescription as="p">This is the alert description with more details about the issue.</AlertDescription>
    </Alert>
  ),
  args: {
    variant: 'warning',
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, AlertTitle, AlertDescription } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Elements/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['warning', 'destructive', 'info'],
    },
  },
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

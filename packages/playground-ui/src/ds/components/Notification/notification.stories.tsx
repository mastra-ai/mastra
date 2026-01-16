import type { Meta, StoryObj } from '@storybook/react-vite';
import { Notification } from './notification';
import { Info, AlertCircle, Check } from 'lucide-react';

const meta: Meta<typeof Notification> = {
  title: 'Feedback/Notification',
  component: Notification,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['info', 'error'],
    },
    isVisible: {
      control: { type: 'boolean' },
    },
    autoDismiss: {
      control: { type: 'boolean' },
    },
    dismissible: {
      control: { type: 'boolean' },
    },
    dismissTime: {
      control: { type: 'number' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Notification>;

export const Default: Story = {
  args: {
    isVisible: true,
    autoDismiss: false,
    children: 'This is a notification message',
  },
};

export const InfoNotification: Story = {
  args: {
    isVisible: true,
    autoDismiss: false,
    type: 'info',
    children: (
      <>
        <Info />
        Your changes have been saved successfully.
      </>
    ),
  },
};

export const ErrorNotification: Story = {
  args: {
    isVisible: true,
    autoDismiss: false,
    type: 'error',
    children: (
      <>
        <AlertCircle />
        An error occurred while saving your changes.
      </>
    ),
  },
};

export const SuccessMessage: Story = {
  args: {
    isVisible: true,
    autoDismiss: false,
    type: 'info',
    children: (
      <>
        <Check />
        Operation completed successfully!
      </>
    ),
  },
};

export const NotDismissible: Story = {
  args: {
    isVisible: true,
    dismissible: false,
    autoDismiss: false,
    children: 'This notification cannot be dismissed',
  },
};

export const AutoDismiss: Story = {
  args: {
    isVisible: true,
    autoDismiss: true,
    dismissTime: 3000,
    children: 'This notification will auto-dismiss in 3 seconds',
  },
};

export const LongContent: Story = {
  args: {
    isVisible: true,
    autoDismiss: false,
    children:
      'This is a longer notification message that contains more detailed information about what happened in the application.',
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast, Toaster } from './toast';
import { Button } from '@/ds/components/Button';

const meta: Meta = {
  title: 'Feedback/Toast',
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <>
        <Toaster position="bottom-right" />
        <Story />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast('This is a default toast')}>
      Show Default Toast
    </Button>
  ),
};

export const DefaultWithDescription: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast('Default Toast', {
          description: 'This is a description for the default toast.',
        })
      }
    >
      Show Default Toast with Description
    </Button>
  ),
};

export const Success: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.success('Operation completed successfully')}>
      Show Success Toast
    </Button>
  ),
};

export const SuccessWithDescription: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.success('Changes saved', {
          description: 'Your changes have been saved successfully.',
        })
      }
    >
      Show Success Toast with Description
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.error('Something went wrong')}>
      Show Error Toast
    </Button>
  ),
};

export const ErrorWithDescription: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.error('Failed to save', {
          description: 'An error occurred while saving your changes. Please try again.',
        })
      }
    >
      Show Error Toast with Description
    </Button>
  ),
};

export const Warning: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.warning('Please review before continuing')}>
      Show Warning Toast
    </Button>
  ),
};

export const WarningWithDescription: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.warning('Unsaved changes', {
          description: 'You have unsaved changes that will be lost if you leave.',
        })
      }
    >
      Show Warning Toast with Description
    </Button>
  ),
};

export const Info: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.info('New update available')}>
      Show Info Toast
    </Button>
  ),
};

export const InfoWithDescription: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.info('Version 2.0 available', {
          description: 'A new version is available. Please refresh to update.',
        })
      }
    >
      Show Info Toast with Description
    </Button>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => toast('Default toast')}>
          Default
        </Button>
        <Button variant="outline" onClick={() => toast.success('Success toast')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error('Error toast')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('Warning toast')}>
          Warning
        </Button>
        <Button variant="outline" onClick={() => toast.info('Info toast')}>
          Info
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() =>
            toast('Default with description', {
              description: 'This is a description.',
            })
          }
        >
          Default + Desc
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            toast.success('Success with description', {
              description: 'This is a description.',
            })
          }
        >
          Success + Desc
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            toast.error('Error with description', {
              description: 'This is a description.',
            })
          }
        >
          Error + Desc
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            toast.warning('Warning with description', {
              description: 'This is a description.',
            })
          }
        >
          Warning + Desc
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            toast.info('Info with description', {
              description: 'This is a description.',
            })
          }
        >
          Info + Desc
        </Button>
      </div>
    </div>
  ),
};

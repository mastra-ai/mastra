import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { toast, Toaster } from './toast';
import { Button } from '@/ds/components/Button';

const meta: Meta = {
  title: 'Feedback/Toast',
  parameters: { layout: 'centered' },
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

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-xs font-medium uppercase tracking-wide text-neutral3">{title}</h3>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const fakeRequest = (shouldFail = false, ms = 1500) =>
  new Promise<{ id: number }>((resolve, reject) =>
    setTimeout(() => (shouldFail ? reject(new Error('Network error')) : resolve({ id: 42 })), ms),
  );

export const Showcase: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-[420px]">
      <Section title="Variants">
        <Button variant="outline" onClick={() => toast('Default toast')}>
          Default
        </Button>
        <Button variant="outline" onClick={() => toast.success('Operation completed successfully')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error('Something went wrong')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('Please review before continuing')}>
          Warning
        </Button>
        <Button variant="outline" onClick={() => toast.info('New update available')}>
          Info
        </Button>
      </Section>

      <Section title="With description">
        <Button
          variant="ghost"
          onClick={() => toast('Heads up', { description: 'This is a default toast with secondary text.' })}
        >
          Default
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast.success('Changes saved', { description: 'Your changes have been saved successfully.' })}
        >
          Success
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast.error('Failed to save', { description: 'An error occurred. Please try again.' })}
        >
          Error
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast.warning('Unsaved changes', { description: 'Your edits will be lost if you leave.' })}
        >
          Warning
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast.info('Version 2.0', { description: 'A new version is available — refresh to update.' })}
        >
          Info
        </Button>
      </Section>

      <Section title="Async / loader">
        <Button
          variant="outline"
          onClick={() =>
            toast.promise({
              myPromise: fakeRequest(false),
              loadingMessage: 'Saving changes…',
              successMessage: 'Changes saved',
              errorMessage: 'Failed to save',
            })
          }
        >
          Promise — resolves
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.promise({
              myPromise: fakeRequest(true),
              loadingMessage: 'Uploading file…',
              successMessage: 'Upload complete',
              errorMessage: 'Upload failed',
            })
          }
        >
          Promise — rejects
        </Button>
      </Section>

      <Section title="Persistence">
        {/* `dismissible: false` only disables swipe-to-dismiss — `closeButton: false` is required
            to hide sonner's native X button on this specific toast. */}
        <Button
          variant="outline"
          onClick={() =>
            toast.warning('System maintenance in progress', {
              description: 'You will be redirected once it completes.',
              duration: Infinity,
              dismissible: false,
              closeButton: false,
            })
          }
        >
          Sticky — non-dismissible
        </Button>
        {/* duration: Infinity, default close button stays */}
        <Button
          variant="outline"
          onClick={() =>
            toast.info('Connection restored', {
              description: 'This toast stays open until you close it.',
              duration: Infinity,
            })
          }
        >
          Sticky — dismissible
        </Button>
      </Section>

      <Section title="Action">
        <Button
          variant="outline"
          onClick={() =>
            toast.success('Task archived', {
              description: 'You can restore it from the archive.',
              action: {
                label: 'Undo',
                onClick: () => toast('Task restored'),
              },
            })
          }
        >
          With action
        </Button>
      </Section>
    </div>
  ),
};

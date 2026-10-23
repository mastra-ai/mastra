import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { toast, Toaster } from './toast';
import { Button } from '@/ds/components/Button/Button';
import { Notice } from '@/ds/components/Notice/Notice';
import { Txt } from '@/ds/components/Txt/Txt';

const meta: Meta = {
  title: 'Feedback/Toast',
  parameters: { layout: 'centered' },
  decorators: [
    (Story, context) => (
      <>
        <Toaster position="bottom-right" {...context.parameters.toaster} />
        <Story />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-column tracking-wide text-muted-foreground uppercase">{title}</h3>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const fakeRequest = (shouldFail = false, ms = 1500) =>
  new Promise<{ id: number }>((resolve, reject) =>
    setTimeout(() => (shouldFail ? reject(new Error('Network error')) : resolve({ id: 42 })), ms),
  );

export const Showcase: Story = {
  render: () => (
    <div className="flex w-105 flex-col gap-6">
      <Section title="Variants">
        <Button onClick={() => toast('Default toast')}>Default</Button>
        <Button onClick={() => toast.success('Operation completed successfully')}>Success</Button>
        <Button onClick={() => toast.error('Something went wrong')}>Error</Button>
        <Button onClick={() => toast.warning('Please review before continuing')}>Warning</Button>
        <Button onClick={() => toast.info('New update available')}>Info</Button>
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

function QuietToastExamples() {
  const [lastAction, setLastAction] = useState('No actions yet');
  const showAll = () => {
    toast.dismiss();
    const options = { duration: Infinity };
    toast.success('Dataset imported', { ...options, description: '24 items added to your dataset.' });
    toast.error('Couldn’t save settings', {
      ...options,
      description: 'Retry to save your changes.',
      closeButton: false,
      action: { label: 'Retry', onClick: () => setLastAction('Retried settings') },
    });
    toast.warning('API key expires soon', { ...options, description: 'Rotate your key before it expires.' });
    toast.info('No deploys yet', { ...options, description: 'Push to a linked branch to create your first deploy.' });
    toast('Changes pending', { ...options, description: 'Review your settings before saving.' });
  };
  return (
    <div className="flex w-full max-w-105 flex-col gap-3">
      <Button onClick={showAll}>Show all tones</Button>
      <Button
        onClick={() =>
          toast.error('Couldn’t load scorers', {
            duration: Infinity,
            description: (
              <div className="flex min-w-0 flex-col gap-2">
                <span>The registry request timed out. Check your connection and retry.</span>
                <div className="flex flex-wrap gap-4">
                  <Notice.Button onClick={() => setLastAction('Retried scorers')}>Retry scorers</Notice.Button>
                  <Notice.Button render={<a href="#troubleshoot" />} onClick={() => setLastAction('Troubleshoot')}>
                    Troubleshoot
                  </Notice.Button>
                </div>
              </div>
            ),
          })
        }
      >
        Show footer actions
      </Button>
      <Button
        onClick={() =>
          toast.info('Connection restored', {
            duration: Infinity,
            description: [
              'The registry connection is available. You can retry loading scorers from this workspace. ',
              'Check that the registry endpoint is reachable and confirm the workspace configuration before retrying. '.repeat(
                24,
              ),
              'Long registry identifier: workspace_registry_' + 'abcdefghijklmnopqrstuvwxyz_0123456789_'.repeat(24),
            ].join(''),
          })
        }
      >
        Show long message
      </Button>
      <Button
        onClick={() =>
          toast.promise({
            myPromise: fakeRequest(false, 1500),
            loadingMessage: 'Saving changes',
            successMessage: 'Changes saved',
          })
        }
      >
        Save changes
      </Button>
      <Button
        onClick={() =>
          toast.info('Review settings', {
            id: 'review-settings',
            duration: Infinity,
            description: 'Choose whether to apply these changes.',
            action: (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setLastAction('Applied settings');
                  toast.dismiss('review-settings');
                }}
              >
                Apply
              </Button>
            ),
            cancel: { label: 'Cancel', onClick: () => setLastAction('Canceled settings') },
          })
        }
      >
        Show action and cancel
      </Button>
      <Button onClick={() => toast.dismiss()}>Dismiss all</Button>
      <Txt as="p" variant="caption" role="status" aria-live="polite">
        {lastAction}
      </Txt>
    </div>
  );
}

export const QuietTints: Story = {
  parameters: { layout: 'padded', toaster: { expand: true, visibleToasts: 6, gap: 16 } },
  render: () => <QuietToastExamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Show action and cancel' }));
    const apply = await body.findByRole('button', { name: 'Apply' });
    await expect(apply.getAttribute('data-variant')).toBe('primary');
    apply.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Applied settings'));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
    await userEvent.click(canvas.getByRole('button', { name: 'Show action and cancel' }));
    const cancel = await body.findByRole('button', { name: 'Cancel' });
    cancel.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Canceled settings'));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
    await userEvent.click(canvas.getByRole('button', { name: 'Show all tones' }));
    const context = canvasElement.ownerDocument.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Canvas color conversion unavailable');
    const light = canvasElement.ownerDocument.documentElement.classList.contains('light');
    const expectedFills = light
      ? { info: [244, 248, 255], success: [243, 251, 244], warning: [255, 249, 232], error: [255, 246, 245] }
      : { info: [19, 23, 30], success: [20, 24, 21], warning: [27, 22, 20], error: [34, 19, 18] };
    for (const tone of ['info', 'success', 'warning', 'error'] as const) {
      const notification = canvasElement.ownerDocument.querySelector(`[data-sonner-toast][data-type="${tone}"]`);
      if (!notification) throw new Error(`Missing ${tone} toast`);
      const style = getComputedStyle(notification);
      context.fillStyle = style.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      await expect(Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)).toEqual(expectedFills[tone]);
      await expect(style.borderTopWidth).toBe('0px');
      if (tone === 'success' && light) await expect(style.boxShadow).toContain('0.5px inset');
      if (!light) await expect(style.boxShadow).not.toContain('color(srgb');
    }
    const retry = await body.findByRole('button', { name: /^Retry$/ });
    await expect(getComputedStyle(retry).textDecorationLine).toBe('none');
    const retryToast = retry.closest('[data-sonner-toast]');
    const message = retryToast?.querySelector('[data-content]');
    if (!message) throw new Error('Missing toast message');
    await expect(retry.getBoundingClientRect().top).toBeGreaterThanOrEqual(message.getBoundingClientRect().bottom + 7);
    await expect(Math.abs(retry.getBoundingClientRect().left - message.getBoundingClientRect().left)).toBeLessThan(1);
    retry.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Retried settings'));
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss all' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
    await userEvent.click(canvas.getByRole('button', { name: 'Show footer actions' }));
    const footer = (await body.findByRole('button', { name: 'Retry scorers' }))
      .closest('[data-sonner-toast]')
      ?.querySelector('[data-content]');
    if (!footer) throw new Error('Missing footer message');
    await waitFor(() => expect(footer.hasAttribute('tabindex')).toBe(false));
    await expect(getComputedStyle(footer).overflowY).toBe('visible');
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss all' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
  },
};

export const Stacked: Story = {
  parameters: { layout: 'padded', toaster: { expand: false, visibleToasts: 3 } },
  render: () => <QuietToastExamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show all tones' }));
    const document = canvasElement.ownerDocument;
    const toaster = document.querySelector('[data-sonner-toaster]');
    if (!toaster) throw new Error('Missing toaster');
    await waitFor(() => expect(toaster.querySelectorAll('[data-sonner-toast][data-visible="true"]')).toHaveLength(3));
    await waitFor(() =>
      expect(toaster.querySelector('[data-front="true"]')?.getAttribute('data-expanded')).toBe('false'),
    );
    await userEvent.hover(toaster);
    await waitFor(() =>
      expect(toaster.querySelector('[data-front="true"]')?.getAttribute('data-expanded')).toBe('true'),
    );
    await userEvent.unhover(toaster);
    await waitFor(() =>
      expect(toaster.querySelector('[data-front="true"]')?.getAttribute('data-expanded')).toBe('false'),
    );
  },
};

export const Neutral: Story = {
  parameters: { layout: 'padded', toaster: { variant: 'neutral', expand: false, visibleToasts: 3 } },
  render: () => <QuietToastExamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show all tones' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(5));
    const context = canvasElement.ownerDocument.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Canvas color conversion unavailable');
    const light = canvasElement.ownerDocument.documentElement.classList.contains('light');
    for (const notification of canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(notification).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      await expect(Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)).toEqual(
        light ? [255, 255, 255] : [20, 20, 20],
      );
    }
  },
};

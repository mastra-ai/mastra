import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheckIcon } from 'lucide-react';
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
      closeButton: false,
      description: 'The registry didn’t respond. Try saving again.',
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
      <Button
        onClick={() =>
          toast.info('Review settings', {
            id: 'primary-action-only',
            duration: Infinity,
            description: 'Choose whether to apply these changes.',
            action: (
              <Button type="button" variant="primary" onClick={() => toast.dismiss('primary-action-only')}>
                Apply
              </Button>
            ),
          })
        }
      >
        Show primary action
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
    const retry = await body.findByRole('button', { name: /^Retry$/ });
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

function ToastDetails() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <span>The registry is available.</span>
      {expanded && <p>Check the registry endpoint and workspace configuration before retrying the connection.</p>}
      <Notice.Button onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide details' : 'Show details'}</Notice.Button>
    </div>
  );
}

export const HoverStability: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Button onClick={() => toast.info('Connection restored', { duration: Infinity, description: <ToastDetails /> })}>
      Show details toast
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    toast.dismiss();
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
    await userEvent.click(canvas.getByRole('button', { name: 'Show details toast' }));
    await userEvent.click(await body.findByRole('button', { name: 'Show details' }));
    const notification = body.getByRole('button', { name: 'Hide details' }).closest('[data-sonner-toast]');
    const toaster = notification?.closest('[data-sonner-toaster]');
    if (!notification || !toaster) throw new Error('Missing details toast');
    await userEvent.hover(toaster);
    await userEvent.unhover(toaster);
    await waitFor(() => expect(notification.getAttribute('data-expanded')).toBe('false'));
    await Promise.all(notification.getAnimations().map(animation => animation.finished));
    const resting = notification.getBoundingClientRect();
    await userEvent.hover(toaster);
    await waitFor(() => expect(notification.getAttribute('data-expanded')).toBe('true'));
    await Promise.all(notification.getAnimations().map(animation => animation.finished));
    const hovered = notification.getBoundingClientRect();
    await expect(Math.abs(hovered.height - resting.height)).toBeLessThan(1);
    await expect(Math.abs(hovered.top - resting.top)).toBeLessThan(1);
    await userEvent.unhover(toaster);
    await Promise.all(notification.getAnimations().map(animation => animation.finished));
  },
};

export const StackedUpdates: Story = {
  parameters: { layout: 'padded', toaster: { visibleToasts: 5 } },
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <QuietToastExamples />
      <Button onClick={() => toast.info('Review updated settings', { id: 'review-settings', duration: Infinity })}>
        Update stacked toast
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const document = canvasElement.ownerDocument;
    toast.dismiss();
    await waitFor(() => expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(0));
    await user.click(canvas.getByRole('button', { name: 'Show action and cancel' }));
    await user.click(canvas.getByRole('button', { name: 'Show footer actions' }));
    await user.click(canvas.getByRole('button', { name: 'Show footer actions' }));
    await user.click(canvas.getByRole('button', { name: 'Show long message' }));
    await waitFor(() => expect(document.querySelectorAll('[data-sonner-toast][data-mounted="true"]')).toHaveLength(4));
    const toaster = document.querySelector('[data-sonner-toaster]');
    if (!toaster) throw new Error('Missing mixed toast stack');
    await user.hover(toaster);
    await user.unhover(toaster);
    await waitFor(() => expect(toaster.querySelectorAll('[data-expanded="false"]')).toHaveLength(4));
    await Promise.all(
      Array.from(document.querySelectorAll('[data-sonner-toast]')).flatMap(notification =>
        notification.getAnimations().map(animation => animation.finished),
      ),
    );
    await user.click(canvas.getByRole('button', { name: 'Update stacked toast' }));
    await within(document.body).findByText('Review updated settings');
    await user.hover(toaster);
    await waitFor(() => expect(toaster.querySelectorAll('[data-expanded="true"]')).toHaveLength(4));
    const notifications = Array.from(toaster.querySelectorAll('[data-sonner-toast]'));
    await Promise.all(
      notifications.flatMap(notification => notification.getAnimations().map(animation => animation.finished)),
    );
    const gap = Number.parseFloat(getComputedStyle(toaster).getPropertyValue('--gap'));
    for (const [index, notification] of notifications.entries()) {
      const bounds = notification.getBoundingClientRect();
      const paddingBottom = Number.parseFloat(getComputedStyle(notification).paddingBottom);
      for (const child of notification.children) {
        if (child.hasAttribute('data-close-button')) continue;
        await expect(child.getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom - paddingBottom + 0.5);
      }
      const previous = notifications[index - 1];
      if (previous) {
        await expect(Math.abs(previous.getBoundingClientRect().top - bounds.bottom - gap)).toBeLessThan(1);
      }
    }
  },
};

export const PromiseCompletion: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Button
      onClick={() =>
        toast.promise({
          myPromise: fakeRequest(),
          loadingMessage: 'Saving changes',
          successMessage: 'Changes saved',
          options: { duration: 3000 },
        })
      }
    >
      Save changes
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    const loading = (await body.findByText('Saving changes')).closest('[data-sonner-toast]');
    if (!loading) throw new Error('Missing loading toast');
    const loadingHeight = loading.getBoundingClientRect().height;
    const saved = await body.findByText('Changes saved', {}, { timeout: 3000 });
    await expect(saved.closest('[data-sonner-toast]')).toBe(loading);
    await expect(Math.abs(loading.getBoundingClientRect().height - loadingHeight)).toBeLessThan(1);
    await waitFor(() => expect(body.queryByText('Changes saved')).toBeNull(), { timeout: 5000 });
  },
};

export const CallerSuccessIcon: Story = {
  ...PromiseCompletion,
  parameters: { layout: 'padded', toaster: { icons: { success: <CircleCheckIcon aria-hidden /> } } },
};

function saveAndFail() {
  toast.promise({
    myPromise: fakeRequest(true),
    loadingMessage: 'Saving changes',
    successMessage: 'Changes saved',
    errorMessage: 'Couldn’t save changes',
    onError: () =>
      toast.error('Couldn’t save changes', { id: 'failed-save', action: { label: 'Retry', onClick: saveAndFail } }),
    options: { id: 'failed-save', description: () => 'The registry didn’t respond. Try saving again.' },
  });
}

export const PromiseFailure: Story = {
  parameters: { layout: 'padded' },
  render: () => <Button onClick={saveAndFail}>Save changes (fails)</Button>,
};

export const Neutral: Story = {
  parameters: { layout: 'padded', toaster: { variant: 'neutral', expand: false, visibleToasts: 3 } },
  render: () => <QuietToastExamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show all tones' }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]')).toHaveLength(5));
    const surfaces = new Set(
      Array.from(
        canvasElement.ownerDocument.querySelectorAll('[data-sonner-toast]'),
        notification => getComputedStyle(notification).backgroundColor,
      ),
    );
    await expect(surfaces.size).toBe(1);
  },
};

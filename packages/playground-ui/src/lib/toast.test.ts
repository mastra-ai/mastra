// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { toast as sonnerToast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '@/test/inert-resize-observer';
import { Toaster, toast } from './toast';

function latestToast() {
  const notification = sonnerToast.getHistory().at(-1);
  if (!notification || !('title' in notification)) throw new Error('Missing toast');
  return notification;
}

afterEach(() => {
  cleanup();
  sonnerToast.dismiss();
  vi.useRealTimers();
});

describe('Toaster', () => {
  describe('when callers override its presentation', () => {
    it('keeps a working native close button', async () => {
      const user = userEvent.setup();
      render(createElement(Toaster, { closeButton: false }));
      act(() => {
        toast.success('Saved');
      });
      await screen.findByText('Saved');
      screen.getByRole('button', { name: 'Close toast' }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.queryByText('Saved')).toBeNull());
    });

    it('keeps native semantic color support enabled', async () => {
      render(createElement(Toaster, { richColors: false }));
      act(() => {
        toast.success('Saved');
      });
      const message = await screen.findByText('Saved');
      expect(message.closest('[data-sonner-toast]')?.getAttribute('data-rich-colors')).toBe('true');
    });

    it('forwards the caller className', async () => {
      const { container } = render(createElement(Toaster, { className: 'my-extra' }));
      act(() => {
        toast.info('Custom notification');
      });
      await screen.findByText('Custom notification');
      expect(container.querySelector('[data-sonner-toaster]')?.classList.contains('my-extra')).toBe(true);
    });

    it('uses the caller position', async () => {
      const { container } = render(createElement(Toaster, { position: 'top-right' }));
      act(() => {
        toast.info('Positioned notification');
      });
      await screen.findByText('Positioned notification');
      const list = container.querySelector('[data-sonner-toaster]');
      expect(list?.getAttribute('data-x-position')).toBe('right');
      expect(list?.getAttribute('data-y-position')).toBe('top');
    });

    it('uses the caller duration instead of the default', async () => {
      vi.useFakeTimers();
      render(createElement(Toaster, { toastOptions: { duration: 9000 } }));
      act(() => {
        toast.info('Timed notification');
      });
      await act(() => vi.advanceTimersByTimeAsync(0));
      await act(() => vi.advanceTimersByTimeAsync(5001));
      expect(screen.queryByText('Timed notification')).not.toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(4200));
      expect(screen.queryByText('Timed notification')).toBeNull();
    });
  });
});

describe('toast variant helpers', () => {
  describe.each(['success', 'error', 'warning', 'info'] as const)('when the tone is %s', method => {
    it('emits the message with the requested tone', () => {
      const id = toast[method]('hello');
      expect(latestToast()).toMatchObject({ id, title: 'hello', type: method });
    });

    it('returns one matching toast ID per message in an array', () => {
      const start = sonnerToast.getHistory().length;
      const ids = toast[method](['one', 'two', 'three']);
      const emitted = sonnerToast.getHistory().slice(start);
      expect(emitted.map(notification => notification.id)).toEqual(ids);
      expect(emitted).toMatchObject([
        { title: 'one', type: method },
        { title: 'two', type: method },
        { title: 'three', type: method },
      ]);
    });
  });
});

describe('toast entry point', () => {
  it('returns one matching toast ID per message in an array', () => {
    const start = sonnerToast.getHistory().length;
    const ids = toast(['one', 'two']);
    const emitted = sonnerToast.getHistory().slice(start);
    expect(emitted.map(notification => notification.id)).toEqual(ids);
    expect(emitted).toMatchObject([{ title: 'one' }, { title: 'two' }]);
  });

  it('preserves a React element message', () => {
    const node = createElement('span', undefined, 'hi');
    const id = toast(node);
    expect(latestToast()).toMatchObject({ id, title: node });
  });

  it.each([42, null])('rejects the unsupported message %s', message => {
    expect(() => toast(message)).toThrow('Invalid message type');
  });

  it('preserves a custom node', () => {
    const node = createElement('span', undefined, 'custom');
    const id = toast.custom(node);
    expect(latestToast()).toMatchObject({ id, title: node });
  });

  it('dismisses only the requested toast', () => {
    const first = toast('First');
    const second = toast('Second');
    if (Array.isArray(first)) throw new Error('Expected one toast ID');
    toast.dismiss(first);
    const active = sonnerToast.getToasts().map(notification => notification.id);
    expect(active).not.toContain(first);
    expect(active).toContain(second);
  });

  describe('when updating an existing toast without changing its actions', () => {
    it('preserves the original React-node action', () => {
      const action = createElement('button', { type: 'button' }, 'Apply');
      toast.info('Preparing', { id: 'action-update', action });
      toast.info('Ready', { id: 'action-update' });
      expect(latestToast().action).toBe(action);
    });

    it('preserves the original cancel action', () => {
      const cancel = { label: 'Cancel', onClick: vi.fn() };
      toast.info('Preparing', { id: 'cancel-update', cancel });
      const original = latestToast().cancel;
      toast.info('Ready', { id: 'cancel-update' });
      expect(latestToast().cancel).toBe(original);
    });
  });
});

describe('toast.promise', () => {
  describe('when the operation succeeds', () => {
    it('replaces the loading message with success', async () => {
      toast.promise({ myPromise: Promise.resolve({ id: 1 }), loadingMessage: 'Saving…', successMessage: 'Saved' });
      expect(latestToast()).toMatchObject({ title: 'Saving…', type: 'loading' });
      await waitFor(() => expect(latestToast()).toMatchObject({ title: 'Saved', type: 'success' }));
    });

    it('passes the resolved data to the caller', async () => {
      const onSuccess = vi.fn();
      toast.promise({ myPromise: Promise.resolve({ id: 1 }), successMessage: 'Saved', onSuccess });
      await waitFor(() => expect(onSuccess).toHaveBeenCalledExactlyOnceWith({ id: 1 }));
    });
  });

  describe('when the operation rejects', () => {
    it('shows the supplied error message', async () => {
      toast.promise({ myPromise: Promise.reject(new Error('boom')), successMessage: 'Saved', errorMessage: 'Failed' });
      await waitFor(() => expect(latestToast()).toMatchObject({ title: 'Failed', type: 'error' }));
    });

    it('uses the Error message when no error message is supplied', async () => {
      toast.promise({ myPromise: Promise.reject(new Error('boom')), successMessage: 'Saved' });
      await waitFor(() => expect(latestToast()).toMatchObject({ title: 'boom', type: 'error' }));
    });

    it('uses the generic message for a non-Error rejection', async () => {
      toast.promise({ myPromise: Promise.reject('a string reason'), successMessage: 'Saved' });
      await waitFor(() => expect(latestToast()).toMatchObject({ title: 'Error...', type: 'error' }));
    });

    it('passes the original rejection to the caller', async () => {
      const onError = vi.fn();
      const error = new Error('boom');
      toast.promise({ myPromise: Promise.reject(error), successMessage: 'Saved', onError });
      await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(error));
    });
  });

  it('supplies the default loading message', async () => {
    toast.promise({ myPromise: Promise.resolve({ id: 1 }), successMessage: 'Saved' });
    expect(latestToast()).toMatchObject({ title: 'Loading...', type: 'loading' });
    await waitFor(() => expect(latestToast().title).toBe('Saved'));
  });

  it('lets caller options override the loading message', async () => {
    toast.promise({ myPromise: Promise.resolve({ id: 1 }), successMessage: 'Saved', options: { loading: 'Mine' } });
    expect(latestToast()).toMatchObject({ title: 'Mine', type: 'loading' });
    await waitFor(() => expect(latestToast().title).toBe('Saved'));
  });
});

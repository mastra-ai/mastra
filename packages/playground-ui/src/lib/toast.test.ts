// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { toast as sonnerToast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '@/test/inert-resize-observer';
import { ErrorNotice, errorToast } from '../utils/error-message';
import type { ErrorMessage } from '../utils/error-message';
import { Toaster, toast } from './toast';

function latestToast() {
  const notification = sonnerToast.getHistory().at(-1);
  if (!notification || !('title' in notification)) throw new Error('Missing toast');
  return notification;
}

afterEach(() => {
  cleanup();
  sonnerToast.dismiss();
  vi.restoreAllMocks();
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

describe('structured error feedback', () => {
  const message: ErrorMessage = {
    title: 'Couldn’t delete orders-db',
    why: 'Two environments still use it.',
    reassurance: 'Nothing was deleted.',
    fix: 'Detach it from both environments, then delete it.',
    wayOut: { kind: 'docs', href: 'https://mastra.ai/docs' },
  };

  it('renders the helper through the existing toast stack', async () => {
    render(createElement(Toaster));
    act(() => {
      errorToast(message);
    });
    await screen.findByText(message.title);
    expect(screen.getByText(`${message.why} ${message.fix}`)).toBeTruthy();
    expect(screen.queryByText('Nothing was deleted.')).toBeNull();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    screen.getByRole('button', { name: 'Docs ↗' }).focus();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledExactlyOnceWith('https://mastra.ai/docs', '_blank', 'noopener,noreferrer');
    await waitFor(() => expect(screen.queryByText(message.title)).toBeNull());
  });

  it('preserves the caller’s retry action and native dismissal', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(createElement(Toaster));
    act(() => {
      errorToast(message, { action: { label: 'Retry', onClick: retry } });
    });
    const action = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.queryByRole('button', { name: 'Docs ↗' })).toBeNull();
    action.focus();
    await user.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText(message.title)).toBeNull());
  });

  it('uses the requested error duration and preserves its auto-close callback', async () => {
    vi.useFakeTimers();
    const onAutoClose = vi.fn();
    render(createElement(Toaster));
    act(() => {
      errorToast(message, { duration: 3000, onAutoClose });
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(screen.queryByText(message.title)).not.toBeNull();
    expect(onAutoClose).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(202));
    expect(screen.queryByText(message.title)).toBeNull();
    expect(onAutoClose).toHaveBeenCalledOnce();
  });

  it('shows reassurance and the external link in the matching notice', () => {
    render(createElement(ErrorNotice, { message }));
    expect(screen.getByText(message.title)).toBeTruthy();
    expect(screen.getByText(`${message.why} ${message.reassurance} ${message.fix}`)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('https://mastra.ai/docs');
  });

  it('allows an error notice without reassurance or a way out', () => {
    const { title, why, fix } = message;
    render(createElement(ErrorNotice, { message: { title, why, fix } }));
    expect(screen.getByText(`${why} ${fix}`)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('toast.promise', () => {
  it.each(['success', 'error'])('starts the %s timeout only after the loading operation settles', async outcome => {
    vi.useFakeTimers();
    const operation = Promise.withResolvers<number>();
    const onAutoClose = vi.fn();
    render(createElement(Toaster));
    act(() => {
      toast.promise({
        myPromise: operation.promise,
        loadingMessage: 'Saving changes',
        successMessage: 'Changes saved',
        errorMessage: 'Couldn’t save changes',
        options: { duration: 1000, onAutoClose },
      });
    });
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Saving changes')).not.toBeNull();
    expect(onAutoClose).not.toHaveBeenCalled();
    await act(async () => {
      if (outcome === 'success') operation.resolve(42);
      else operation.reject(new Error('Connection interrupted'));
      await vi.advanceTimersByTimeAsync(0);
    });
    const result = outcome === 'success' ? 'Changes saved' : 'Couldn’t save changes';
    expect(screen.queryByText(result)).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(screen.queryByText(result)).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(202));
    expect(screen.queryByText(result)).toBeNull();
    expect(onAutoClose).toHaveBeenCalledOnce();
  });

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

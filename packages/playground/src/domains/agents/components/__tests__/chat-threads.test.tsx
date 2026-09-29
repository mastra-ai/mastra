import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAllowedCapabilities, writeDeniedCapabilities } from '../../hooks/__tests__/fixtures/auth';
import type { ChatThreadsProps } from '../chat-threads';
import { ChatThreads } from '../chat-threads';
import { namedThread } from './fixtures/threads';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  // `usePermissions` inside ChatThreads fetches auth capabilities.
  server.use(http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)));
});

const renderThreads = (onHidePanel?: () => void) =>
  renderWithProviders(
    <TestLinkProvider>
      <ChatThreads
        threads={[]}
        threadId="thread-1"
        onDelete={() => {}}
        resourceId="agent-1"
        resourceType="agent"
        onHidePanel={onHidePanel}
      />
    </TestLinkProvider>,
  );

describe('ChatThreads — hide threads panel', () => {
  it('offers no hide control when the panel cannot be hidden', () => {
    renderThreads();

    expect(screen.getByRole('link', { name: 'New Chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide threads panel' })).toBeNull();
  });

  it('places a hide control on the New Chat row and reports the click', () => {
    const onHidePanel = vi.fn();
    renderThreads(onHidePanel);

    const hideButton = screen.getByRole('button', { name: 'Hide threads panel' });
    const newChat = screen.getByRole('link', { name: 'New Chat' });
    expect(hideButton.parentElement).toBe(newChat.parentElement);

    fireEvent.click(hideButton);

    expect(onHidePanel).toHaveBeenCalledTimes(1);
  });

  it('advertises the { shortcut in the hide control tooltip', async () => {
    renderThreads(vi.fn());

    fireEvent.focus(screen.getByRole('button', { name: 'Hide threads panel' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Hide threads panel');
    expect(tooltip.querySelector('kbd')?.textContent).toBe('{');
  });
});

const renderWithThread = (props: Partial<ChatThreadsProps> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <ChatThreads
        threads={[
          { ...namedThread, createdAt: new Date(namedThread.createdAt), updatedAt: new Date(namedThread.updatedAt) },
        ]}
        threadId="thread-1"
        onDelete={() => {}}
        resourceId="agent-1"
        resourceType="agent"
        {...props}
      />
    </TestLinkProvider>,
  );

const openRenameDialog = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
  return screen.findByRole('dialog', { name: 'Rename chat' });
};

describe('ChatThreads — thread actions', () => {
  describe('when the user can write and delete memory', () => {
    it('shows a thread actions menu instead of a delete button', async () => {
      renderWithThread({ onRename: vi.fn() });

      expect(await screen.findByRole('button', { name: 'Thread actions' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'delete thread' })).toBeNull();
    });

    it('lists Rename and Delete in the menu', async () => {
      renderWithThread({ onRename: vi.fn() });

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
    });

    it('opens a rename dialog prefilled with the thread title', async () => {
      renderWithThread({ onRename: vi.fn() });

      await openRenameDialog();

      expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe('Trip planning');
    });

    it('prefills the rename input with a default-titled thread title', async () => {
      renderWithThread({
        onRename: vi.fn(),
        threads: [
          {
            ...namedThread,
            title: 'New Thread 2026-01-01T00:00:00.000Z',
            createdAt: new Date(namedThread.createdAt),
            updatedAt: new Date(namedThread.updatedAt),
          },
        ],
      });

      await openRenameDialog();

      expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe(
        'New Thread 2026-01-01T00:00:00.000Z',
      );
    });

    it('calls onRename with the trimmed new title on submit', async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      renderWithThread({ onRename });

      await openRenameDialog();
      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '  Paris trip  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(onRename).toHaveBeenCalledWith('thread-1', 'Paris trip'));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rename chat' })).toBeNull());
    });

    it('disables Save when the title is empty or unchanged', async () => {
      renderWithThread({ onRename: vi.fn() });

      await openRenameDialog();
      const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '   ' } });
      expect(save.disabled).toBe(true);
    });

    it('asks for confirmation before deleting', async () => {
      const onDelete = vi.fn();
      renderWithThread({ onDelete, onRename: vi.fn() });

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(onDelete).not.toHaveBeenCalled();

      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

      expect(onDelete).toHaveBeenCalledWith('thread-1');
    });
  });

  describe('when no rename handler is provided', () => {
    it('only offers Delete in the menu', async () => {
      renderWithThread();

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull();
    });
  });

  describe('when the user can only read memory', () => {
    beforeEach(() => {
      server.use(http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeDeniedCapabilities)));
    });

    it('shows no thread actions menu', async () => {
      renderWithThread({ onRename: vi.fn() });

      expect(await screen.findByText('Trip planning')).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Thread actions' })).toBeNull());
    });
  });
});

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAllowedCapabilities, writeDeniedCapabilities } from '../../hooks/__tests__/fixtures/auth';
import type { ChatThreadsProps } from '../chat-threads';
import { ChatThreads } from '../chat-threads';
import { namedThread, otherThread } from './fixtures/threads';
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

    expect(screen.getByRole('link', { name: 'New Thread' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide threads panel' })).toBeNull();
  });

  it('places a hide control on the New Chat row and reports the click', () => {
    const onHidePanel = vi.fn();
    renderThreads(onHidePanel);

    const hideButton = screen.getByRole('button', { name: 'Hide threads panel' });
    const newChat = screen.getByRole('link', { name: 'New Thread' });
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
  return screen.findByRole('dialog', { name: 'Rename thread' });
};

describe('ChatThreads — thread actions', () => {
  describe('when the user can write and delete memory', () => {
    it('shows a thread actions menu instead of a delete button', async () => {
      renderWithThread();

      expect(await screen.findByRole('button', { name: 'Thread actions' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'delete thread' })).toBeNull();
    });

    it('lists Rename and Delete in the menu', async () => {
      renderWithThread();

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
    });

    it('opens a rename dialog prefilled with the thread title', async () => {
      renderWithThread();

      await openRenameDialog();

      expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe('Trip planning');
    });

    it('prefills the rename input with a default-titled thread title', async () => {
      renderWithThread({
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

    it('saves the trimmed new title and closes the dialog', async () => {
      const patched = vi.fn();
      server.use(
        http.patch(`${TEST_BASE_URL}/api/memory/threads/thread-1`, async ({ request }) => {
          const body = (await request.json()) as { title: string };
          patched(new URL(request.url).searchParams.get('agentId'), body.title);
          return HttpResponse.json({ ...namedThread, title: body.title });
        }),
      );
      renderWithThread();

      await openRenameDialog();
      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '  Paris trip  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(patched).toHaveBeenCalledWith('agent-1', 'Paris trip'));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rename thread' })).toBeNull());
    });

    it('disables Save when the title is empty or unchanged', async () => {
      renderWithThread();

      await openRenameDialog();
      const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '   ' } });
      expect(save.disabled).toBe(true);
    });

    it('asks for confirmation before deleting', async () => {
      const onDelete = vi.fn();
      renderWithThread({ onDelete });

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(onDelete).not.toHaveBeenCalled();

      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

      expect(onDelete).toHaveBeenCalledWith('thread-1');
    });
  });

  describe('when the threads belong to a network', () => {
    it('only offers Delete in the menu', async () => {
      renderWithThread({ resourceType: 'network' });

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull();
    });
  });

  describe('when the user can only read memory', () => {
    beforeEach(() => {
      server.use(http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeDeniedCapabilities)));
    });

    it('only offers Pin in the menu', async () => {
      renderWithThread();

      fireEvent.click(await screen.findByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Pin' })).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull());
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    });
  });
});

const PIN_KEY = 'mastra:pinned-threads:agent:agent-1';
const toThread = (t: typeof namedThread) => ({
  ...t,
  createdAt: new Date(t.createdAt),
  updatedAt: new Date(t.updatedAt),
});
const renderTwoThreads = () => renderWithThread({ threads: [toThread(namedThread), toThread(otherThread)] });
const pinnedSection = () => screen.queryByRole('region', { name: 'Pinned' });

describe('ChatThreads — pinning', () => {
  beforeEach(() => localStorage.clear());

  describe('when no thread is pinned', () => {
    it('renders no Pinned section', async () => {
      renderTwoThreads();

      expect(await screen.findByText('Trip planning')).toBeTruthy();
      expect(pinnedSection()).toBeNull();
    });

    it('renders no Recent heading', async () => {
      renderTwoThreads();

      expect(await screen.findByText('Trip planning')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Recent' })).toBeNull();
    });

    it('offers Pin in the thread menu', async () => {
      renderTwoThreads();

      fireEvent.click((await screen.findAllByRole('button', { name: 'Thread actions' }))[0]);

      expect(await screen.findByRole('menuitem', { name: 'Pin' })).toBeTruthy();
    });
  });

  describe('when the user pins a thread from the actions menu', () => {
    const pinFirst = async () => {
      renderTwoThreads();
      fireEvent.click((await screen.findAllByRole('button', { name: 'Thread actions' }))[0]);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin' }));
    };

    it('moves the thread into the Pinned section above the list', async () => {
      await pinFirst();

      const section = await screen.findByRole('region', { name: 'Pinned' });
      expect(within(section).getByText('Trip planning')).toBeTruthy();
      expect(screen.getAllByTestId('thread-list')).toHaveLength(2);
    });

    it('groups the other threads under a Recent section', async () => {
      await pinFirst();

      const recent = await screen.findByRole('region', { name: 'Recent' });
      expect(within(recent).getByText('Budget review')).toBeTruthy();
      expect(within(recent).queryByText('Trip planning')).toBeNull();
    });

    it('persists the pin in localStorage', async () => {
      await pinFirst();

      await waitFor(() => expect(JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]')).toEqual(['thread-1']));
    });
  });

  describe('when a pin is stored in localStorage', () => {
    beforeEach(() => localStorage.setItem(PIN_KEY, JSON.stringify(['thread-2'])));

    it('renders the Pinned section on mount', async () => {
      renderTwoThreads();

      const section = await screen.findByRole('region', { name: 'Pinned' });
      expect(within(section).getByText('Budget review')).toBeTruthy();
    });

    it('offers Unpin, Rename and Delete in the pinned row menu', async () => {
      renderTwoThreads();

      const section = await screen.findByRole('region', { name: 'Pinned' });
      fireEvent.click(within(section).getByRole('button', { name: 'Thread actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Unpin' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Pin' })).toBeNull();
    });
  });

  describe('when the user clicks Unpin', () => {
    beforeEach(() => localStorage.setItem(PIN_KEY, JSON.stringify(['thread-2'])));

    const unpinFromMenu = async () => {
      const section = await screen.findByRole('region', { name: 'Pinned' });
      fireEvent.click(within(section).getByRole('button', { name: 'Thread actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Unpin' }));
    };

    it('returns the thread to the main list and removes the Pinned section', async () => {
      renderTwoThreads();

      await unpinFromMenu();

      await waitFor(() => expect(pinnedSection()).toBeNull());
      expect(within(screen.getByTestId('thread-list')).getByText('Budget review')).toBeTruthy();
    });

    it('removes the pin from localStorage', async () => {
      renderTwoThreads();

      await unpinFromMenu();

      await waitFor(() => expect(JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]')).toEqual([]));
    });
  });

  describe('when the user renames a pinned thread', () => {
    beforeEach(() => localStorage.setItem(PIN_KEY, JSON.stringify(['thread-2'])));

    it('opens the rename dialog prefilled with the pinned thread title', async () => {
      renderTwoThreads();

      const section = await screen.findByRole('region', { name: 'Pinned' });
      fireEvent.click(within(section).getByRole('button', { name: 'Thread actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));

      await screen.findByRole('dialog', { name: 'Rename thread' });
      expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe('Budget review');
    });
  });

  describe('when the user deletes a pinned thread', () => {
    beforeEach(() => localStorage.setItem(PIN_KEY, JSON.stringify(['thread-2'])));

    const deleteFromMenu = async () => {
      const section = await screen.findByRole('region', { name: 'Pinned' });
      fireEvent.click(within(section).getByRole('button', { name: 'Thread actions' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    };

    it('calls onDelete with the pinned thread id', async () => {
      const onDelete = vi.fn();
      renderWithThread({ threads: [toThread(namedThread), toThread(otherThread)], onDelete });

      await deleteFromMenu();

      expect(onDelete).toHaveBeenCalledWith('thread-2');
    });

    it('removes the pin from localStorage', async () => {
      renderTwoThreads();

      await deleteFromMenu();

      await waitFor(() => expect(JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]')).toEqual([]));
    });
  });

  describe('when the stored pin references a thread that no longer exists', () => {
    beforeEach(() => localStorage.setItem(PIN_KEY, JSON.stringify(['deleted-thread'])));

    it('renders no Pinned section', async () => {
      renderTwoThreads();

      expect(await screen.findByText('Trip planning')).toBeTruthy();
      expect(pinnedSection()).toBeNull();
    });
  });
});

const COLLAPSED_KEY = 'mastra:thread-sections-collapsed';

describe('ChatThreads — collapsible sections', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PIN_KEY, JSON.stringify(['thread-2']));
  });

  describe('when the user collapses the Pinned section', () => {
    it('hides the pinned threads and marks the toggle collapsed', async () => {
      renderTwoThreads();

      const toggle = await screen.findByRole('button', { name: 'Pinned' });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(toggle);

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Budget review')).toBeNull();
      expect(screen.getByText('Trip planning')).toBeTruthy();
    });

    it('stores the collapsed section in localStorage', async () => {
      renderTwoThreads();

      fireEvent.click(await screen.findByRole('button', { name: 'Pinned' }));

      await waitFor(() => expect(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')).toEqual(['pinned']));
    });
  });

  describe('when the user collapses the Recent section', () => {
    it('hides the recent threads', async () => {
      renderTwoThreads();

      fireEvent.click(await screen.findByRole('button', { name: 'Recent' }));

      expect(screen.queryByText('Trip planning')).toBeNull();
      expect(screen.getByText('Budget review')).toBeTruthy();
    });
  });

  describe('when a collapsed section is stored in localStorage', () => {
    beforeEach(() => localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['pinned'])));

    it('renders the section collapsed on mount', async () => {
      renderTwoThreads();

      const toggle = await screen.findByRole('button', { name: 'Pinned' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Budget review')).toBeNull();
    });

    it('expands it again on click', async () => {
      renderTwoThreads();

      fireEvent.click(await screen.findByRole('button', { name: 'Pinned' }));

      expect(screen.getByText('Budget review')).toBeTruthy();
      await waitFor(() => expect(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')).toEqual([]));
    });
  });
});

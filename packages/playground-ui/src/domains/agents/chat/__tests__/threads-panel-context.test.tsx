// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ThreadsPanelProvider } from '../threads-panel-context';
import { useThreadsPanel } from '../use-threads-panel';

function ThreadsPanel() {
  const panel = useThreadsPanel();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    panel?.registerPanel({
      collapse: () => setOpen(false),
      expand: () => setOpen(true),
      toggle: () => setOpen(current => !current),
    });
    return () => panel?.registerPanel(null);
  }, [panel]);

  return (
    <>
      <p>{open ? 'Threads visible' : 'Threads hidden'}</p>
      <button onClick={() => panel?.collapseOnce()}>Open empty chat</button>
      <button onClick={() => panel?.collapse()}>Hide threads</button>
      <button onClick={() => panel?.toggle()}>Toggle threads</button>
      <button onClick={() => panel?.expandIfAutoCollapsed()}>Refresh threads</button>
    </>
  );
}

describe('ThreadsPanelProvider', () => {
  describe('when the empty chat automatically hides threads', () => {
    it('keeps threads hidden after the user manually hides them again and refreshes', () => {
      render(
        <ThreadsPanelProvider>
          <ThreadsPanel />
        </ThreadsPanelProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open empty chat' }));
      expect(screen.getByText('Threads hidden')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Toggle threads' }));
      expect(screen.getByText('Threads visible')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hide threads' }));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh threads' }));
      expect(screen.getByText('Threads hidden')).toBeTruthy();
    });

    it('does not undo a manual toggle when the thread list refreshes', () => {
      render(
        <ThreadsPanelProvider>
          <ThreadsPanel />
        </ThreadsPanelProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open empty chat' }));
      fireEvent.click(screen.getByRole('button', { name: 'Toggle threads' }));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh threads' }));
      expect(screen.getByText('Threads visible')).toBeTruthy();
    });

    it('restores threads after refresh when the user has not changed the automatic collapse', () => {
      render(
        <ThreadsPanelProvider>
          <ThreadsPanel />
        </ThreadsPanelProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open empty chat' }));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh threads' }));
      expect(screen.getByText('Threads visible')).toBeTruthy();
    });
  });
});

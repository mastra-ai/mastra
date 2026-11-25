// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentConversationThreads } from './agent-conversation-threads';

const threads = [
  { id: 'one', title: 'First conversation' },
  { id: 'two', title: 'Second conversation' },
];

const renderThreads = (onSelectThread = vi.fn(), onCollapse = vi.fn()) =>
  render(
    <AgentConversationThreads
      threads={threads}
      selectedThreadId="one"
      onSelectThread={onSelectThread}
      onNewThread={vi.fn()}
      onCollapse={onCollapse}
    />,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AgentConversationThreads', () => {
  describe('when a thread is selected', () => {
    it('notifies the host which thread was chosen', () => {
      const onSelectThread = vi.fn();
      renderThreads(onSelectThread);

      screen.getByRole('button', { name: 'Second conversation' }).click();

      expect(onSelectThread).toHaveBeenCalledExactlyOnceWith('two');
    });
  });

  describe('when the sidebar is displayed on desktop', () => {
    it('offers a hide action owned by the host', () => {
      const onCollapse = vi.fn();
      renderThreads(vi.fn(), onCollapse);

      screen.getByRole('button', { name: 'Hide threads panel' }).click();

      expect(onCollapse).toHaveBeenCalledOnce();
    });
  });

  describe('when the sidebar is displayed inside a mobile drawer', () => {
    it('does not offer a redundant hide action', () => {
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      renderThreads();

      expect(screen.queryByRole('button', { name: 'Hide threads panel' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Second conversation' })).toBeTruthy();
    });
  });
});

// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessages } from '../chat-messages';

const message: MastraDBMessage = {
  id: 'reply',
  role: 'assistant',
  createdAt: new Date('2026-09-10'),
  content: { format: 2, parts: [{ type: 'text', text: 'A **complete** answer' }] },
};
afterEach(cleanup);
describe('ChatMessages', () => {
  describe('when rendered without application providers', () => {
    it('renders stored message markdown', () => {
      render(<ChatMessages messages={[message]} isRunning={false} />);
      expect(screen.getByText('complete').tagName).toBe('STRONG');
    });
    it('keeps local copying available without external actions', () => {
      render(<ChatMessages messages={[message]} isRunning={false} />);
      expect(screen.getByRole('button', { name: 'Copy' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull();
    });
  });
  describe('when reading aloud is supplied', () => {
    it('passes the selected message and its text to the parent', () => {
      const onReadAloud = vi.fn();
      render(<ChatMessages messages={[message]} isRunning={false} onReadAloud={onReadAloud} />);
      fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
      expect(onReadAloud).toHaveBeenCalledWith(message, 'A **complete** answer');
    });
  });
  describe('when the server reconciles an optimistic message', () => {
    it('preserves the existing message DOM node', () => {
      const optimistic: MastraDBMessage = {
        ...message,
        id: 'client-id',
        role: 'user',
        content: { ...message.content, metadata: { clientMessageId: 'client-id' } },
      };
      const { rerender } = render(<ChatMessages messages={[optimistic]} isRunning={false} />);
      const original = screen.getByText('complete');
      rerender(<ChatMessages messages={[{ ...optimistic, id: 'server-id' }]} isRunning={false} />);
      expect(screen.getByText('complete')).toBe(original);
    });
  });
  describe('when the message list is empty', () => {
    it('leaves empty and loading UI to its parent', () => {
      const { container } = render(<ChatMessages messages={[]} isRunning={false} />);
      expect(container.innerHTML).toBe('');
    });
  });
});

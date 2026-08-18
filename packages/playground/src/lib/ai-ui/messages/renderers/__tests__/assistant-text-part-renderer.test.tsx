import type { TextPart } from '@mastra/react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MessageMetadata } from '../../message-metadata';
import { AssistantTextPartRenderer } from '../assistant-text-part-renderer';

const CHUNK = `Ready. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;

const textPart = (text: string, state?: TextPart['state']): TextPart => ({ type: 'text', text, state });

function drain(read: () => string | null, target: string) {
  for (let frames = 0; frames < 300 && read() !== target; frames++) {
    act(() => void vi.advanceTimersByTime(16));
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AssistantTextPartRenderer', () => {
  it('renders markdown text', () => {
    const part = { type: 'text', text: 'hello **world**' } as TextPart;

    render(<AssistantTextPartRenderer part={part} />);

    expect(screen.getByText('world')).not.toBeNull();
  });

  it('renders the empty string safely when text is missing', () => {
    const part = { type: 'text' } as TextPart;

    const { container } = render(<AssistantTextPartRenderer part={part} />);

    expect(container).not.toBeNull();
  });

  it('routes error-status metadata into an error notice', () => {
    const part = { type: 'text', text: 'boom' } as TextPart;
    const metadata: MessageMetadata = { status: 'error' };

    render(<AssistantTextPartRenderer part={part} metadata={metadata} />);

    expect(screen.getByText('boom')).not.toBeNull();
    expect(screen.getByText('Error')).not.toBeNull();
  });

  describe('when completionResult metadata is present', () => {
    it('renders the completion check collapsed by default with the shared tool disclosure', () => {
      const part = { type: 'text', text: 'all good' } as TextPart;
      const metadata: MessageMetadata = { completionResult: { passed: true } };

      render(<AssistantTextPartRenderer part={part} metadata={metadata} />);

      const completionCheck = screen.getByRole('group', { name: 'Completion check' });
      expect(within(completionCheck).queryByText('all good')).toBeNull();
      fireEvent.click(within(completionCheck).getByRole('button', { name: 'Show completion check' }));

      const completionResult = within(completionCheck).getByRole('group', { name: 'Completion check result' });
      expect(within(completionResult).getByText('Complete')).not.toBeNull();
      expect(within(completionResult).getByText('all good')).not.toBeNull();
    });
  });

  describe('when a chunk lands on a reply that is still streaming', () => {
    it('reveals it over time instead of dumping it on arrival', () => {
      vi.useFakeTimers();
      const { container, rerender } = render(<AssistantTextPartRenderer part={textPart('Ready.', 'streaming')} />);

      rerender(<AssistantTextPartRenderer part={textPart(CHUNK, 'streaming')} />);
      expect(container.textContent?.length).toBeLessThan(CHUNK.length);

      drain(() => container.textContent, CHUNK);
      expect(container.textContent).toBe(CHUNK);
    });
  });

  describe('when the reply ends on the chunk it is still revealing', () => {
    it('finishes revealing it', () => {
      vi.useFakeTimers();
      const { container, rerender } = render(<AssistantTextPartRenderer part={textPart('Ready.', 'streaming')} />);

      rerender(<AssistantTextPartRenderer part={textPart(CHUNK)} />);
      expect(container.textContent?.length).toBeLessThan(CHUNK.length);

      drain(() => container.textContent, CHUNK);
      expect(container.textContent).toBe(CHUNK);
    });
  });
});

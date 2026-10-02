// @vitest-environment jsdom
import type { TextPart } from '@mastra/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantTextPartRenderer } from '../assistant-text-part-renderer';
import { UserTextPartRenderer } from '../user-text-part-renderer';

const text = '| Name |\n| --- |\n| Tokyo |';
const part: TextPart = { type: 'text', text, state: 'done' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Assistant table actions', () => {
  describe('when an assistant text segment is finished', () => {
    it('copies its table as markdown', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      render(<AssistantTextPartRenderer part={part} />);
      fireEvent.click(screen.getByRole('button', { name: 'Copy table as markdown' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(text));
    });
  });

  describe('when an assistant text segment is streaming', () => {
    it('disables both table actions', () => {
      render(<AssistantTextPartRenderer part={{ ...part, state: 'streaming' }} />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'More table options' }).disabled).toBe(true);
    });
  });

  describe('when finished text is still being revealed', () => {
    it('waits for the reveal to finish before enabling table actions', () => {
      const { rerender } = render(<AssistantTextPartRenderer part={part} revealing />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'More table options' }).disabled).toBe(true);
      rerender(<AssistantTextPartRenderer part={part} revealing={false} />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy table as markdown' }).disabled).toBe(false);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'More table options' }).disabled).toBe(false);
    });
  });

  describe('when a user message contains a table', () => {
    it('renders the table without assistant export controls', () => {
      render(<UserTextPartRenderer part={part} />);
      expect(screen.getByRole('table').textContent).toContain('Tokyo');
      expect(screen.queryByRole('button', { name: 'Copy table as markdown' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'More table options' })).toBeNull();
    });
  });
});

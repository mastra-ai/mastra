// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Reasoning } from './reasoning';

afterEach(() => cleanup());

describe('Reasoning', () => {
  describe('when there is reasoning text', () => {
    it('shows the text expanded by default', () => {
      render(<Reasoning text="Let me think" />);

      expect(screen.getByText('Let me think')).not.toBeNull();
      expect(screen.getByRole('button', { name: /Hide reasoning/ })).not.toBeNull();
    });

    it('collapses and re-expands when the toggle is clicked', () => {
      render(<Reasoning text="Let me think" />);

      fireEvent.click(screen.getByRole('button', { name: /Hide reasoning/ }));
      expect(screen.getByRole('button', { name: /Show reasoning/ }).getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Let me think')).toBeNull();
      expect(screen.getByRole('button', { name: /Show reasoning/ })).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Show reasoning/ }));
      expect(screen.getByText('Let me think')).not.toBeNull();
      expect(screen.getByRole('button', { name: /Hide reasoning/ }).getAttribute('aria-expanded')).toBe('true');
    });

    it('renders markdown links and inline code', () => {
      render(<Reasoning text="Check [the docs](https://mastra.ai/docs) before changing `agent.stream()`." />);

      expect(screen.getByRole('link', { name: 'the docs' }).getAttribute('href')).toBe('https://mastra.ai/docs');
      expect(screen.getByText('agent.stream()').tagName).toBe('CODE');
    });

    it('keeps a collapsed passage closed when more reasoning arrives', () => {
      const { rerender } = render(<Reasoning text="First thought" streaming />);
      fireEvent.click(screen.getByRole('button', { name: 'Hide reasoning' }));

      rerender(<Reasoning text="First thought, then another" streaming />);

      expect(screen.queryByText('First thought, then another')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show reasoning' }));
      expect(screen.getByText('First thought, then another')).toBeTruthy();
    });
  });

  describe('when the reasoning was redacted', () => {
    it('shows the redaction notice instead of the text', () => {
      render(<Reasoning text="secret" redacted />);

      expect(screen.getByText('Reasoning was redacted by the provider.')).not.toBeNull();
      expect(screen.queryByText('secret')).toBeNull();
    });
  });

  describe('when there is nothing to show', () => {
    it.each(['', ' \n '])('renders nothing for blank text (%s)', text => {
      const { container } = render(<Reasoning text={text} />);

      expect(container.innerHTML).toBe('');
    });
  });
});

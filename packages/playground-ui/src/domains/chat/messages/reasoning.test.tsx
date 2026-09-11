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
      expect(screen.queryByText('Let me think')).toBeNull();
      expect(screen.getByRole('button', { name: /Show reasoning/ })).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Show reasoning/ }));
      expect(screen.getByText('Let me think')).not.toBeNull();
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
    it('renders nothing for empty text', () => {
      const { container } = render(<Reasoning text="" />);

      expect(container.innerHTML).toBe('');
    });
  });
});

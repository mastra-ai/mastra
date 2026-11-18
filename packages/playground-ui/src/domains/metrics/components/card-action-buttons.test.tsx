// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpenErrorsInLogsButton, OpenInTracesButton } from './card-action-buttons';

describe('OpenInTracesButton', () => {
  describe('when clicked', () => {
    it('calls the handler', () => {
      const onClick = vi.fn();
      render(<OpenInTracesButton onClick={onClick} />);

      fireEvent.click(screen.getByRole('button', { name: 'View in traces' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});

describe('OpenErrorsInLogsButton', () => {
  describe('when clicked', () => {
    it('calls the handler', () => {
      const onClick = vi.fn();
      render(<OpenErrorsInLogsButton onClick={onClick} />);

      fireEvent.click(screen.getByRole('button', { name: 'View errors in logs' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});

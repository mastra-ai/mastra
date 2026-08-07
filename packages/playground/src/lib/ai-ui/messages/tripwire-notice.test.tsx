import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TripwireNotice } from './tripwire-notice';

afterEach(() => cleanup());

describe('TripwireNotice', () => {
  describe('when only a reason is provided', () => {
    it('renders the blocked title and the reason', () => {
      render(<TripwireNotice reason="blocked for safety" />);

      expect(screen.getByText('Content Blocked')).not.toBeNull();
      expect(screen.getByText('blocked for safety')).not.toBeNull();
    });

    it('does not offer a details toggle', () => {
      render(<TripwireNotice reason="blocked for safety" />);

      expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
    });

    it('uses the warning notice tokens instead of hardcoded colors', () => {
      const { container } = render(<TripwireNotice reason="blocked for safety" />);

      expect(container.querySelector('[class*="notice-warning"]')).not.toBeNull();
      expect(container.querySelector('[class*="amber"]')).toBeNull();
    });
  });

  describe('when tripwire metadata is provided', () => {
    const tripwire = {
      reason: 'blocked for safety',
      retry: false,
      processorId: 'moderation',
      metadata: { category: 'violence' },
    };

    it('keeps the details collapsed until requested', () => {
      render(<TripwireNotice reason="blocked for safety" tripwire={tripwire} />);

      expect(screen.getByRole('button', { name: 'Details' })).not.toBeNull();
      expect(screen.queryByText('Not allowed')).toBeNull();
    });

    it('reveals retry, processor and metadata once expanded', () => {
      render(<TripwireNotice reason="blocked for safety" tripwire={tripwire} />);

      fireEvent.click(screen.getByRole('button', { name: 'Details' }));

      expect(screen.getByText('Not allowed')).not.toBeNull();
      expect(screen.getByText('moderation')).not.toBeNull();
      expect(screen.getByText(/"category": "violence"/)).not.toBeNull();
    });
  });

  describe('when retry is allowed', () => {
    it('reports the retry as allowed', () => {
      render(<TripwireNotice reason="blocked for safety" tripwire={{ reason: 'blocked for safety', retry: true }} />);

      fireEvent.click(screen.getByRole('button', { name: 'Details' }));

      expect(screen.getByText('Allowed')).not.toBeNull();
    });
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  describe('when rendered inside text', () => {
    it('uses phrasing content and forwards span attributes', () => {
      render(
        <p>
          Status: <Badge title="Publication status">Published</Badge>
        </p>,
      );

      const badge = screen.getByText('Published');
      expect(badge.tagName).toBe('SPAN');
      expect(badge.getAttribute('title')).toBe('Publication status');
      expect(badge.parentElement?.textContent).toBe('Status: Published');
    });
  });

  describe('when rendered with a status indicator', () => {
    it('keeps the indicator decorative and off the public DOM attributes', () => {
      render(<Badge indicator="dot">Connected</Badge>);

      const badge = screen.getByText('Connected');
      const indicator = badge.querySelector('[aria-hidden="true"]');

      expect(badge.hasAttribute('indicator')).toBe(false);
      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toBe('');
    });
  });

  describe('when rendered with an icon', () => {
    it('renders the icon while preserving the badge label', () => {
      render(<Badge icon={<svg data-testid="badge-icon" />}>Template</Badge>);

      expect(screen.getByText('Template')).not.toBeNull();
      expect(screen.getByTestId('badge-icon')).not.toBeNull();
    });

    it('does not reserve an icon wrapper for an empty icon', () => {
      render(<Badge icon={null}>Template</Badge>);

      expect(screen.getByText('Template').querySelector('span')).toBeNull();
    });
  });
});

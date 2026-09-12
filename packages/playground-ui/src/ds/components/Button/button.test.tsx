// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { Button } from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  describe('icon prop', () => {
    it('renders the icon inside an <Icon> slot before the label', () => {
      render(
        <Button icon={<svg data-testid="icon" />} size="sm">
          Add item
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Add item' });
      const slot = button.querySelector('[data-slot="button-icon"]');
      expect(slot).not.toBeNull();
      expect(slot?.contains(screen.getByTestId('icon'))).toBe(true);
      expect(button.firstElementChild).toBe(slot);
    });

    it('does not render a slot when no icon is provided', () => {
      render(<Button>Plain</Button>);
      expect(screen.getByRole('button').querySelector('[data-slot="button-icon"]')).toBeNull();
    });

    it('is ignored in icon-mode sizes', () => {
      render(
        <Button size="icon-md" icon={<svg data-testid="ignored" />} aria-label="Close">
          <svg data-testid="child" />
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Close' });
      expect(button.querySelector('[data-slot="button-icon"]')).toBeNull();
      expect(screen.queryByTestId('ignored')).toBeNull();
      expect(screen.getByTestId('child')).toBeTruthy();
    });

    it('does not derive aria-label from tooltip when a label is present', () => {
      render(
        <TooltipProvider>
          <Button icon={<svg />} tooltip="Add a new item">
            Add
          </Button>
        </TooltipProvider>,
      );
      expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-label')).toBeNull();
    });
  });
});

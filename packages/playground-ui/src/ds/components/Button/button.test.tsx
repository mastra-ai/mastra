// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  describe('when a disabled control must remain focusable', () => {
    it('uses aria-disabled and blocks activation', () => {
      const onClick = vi.fn();
      const onParentClick = vi.fn();

      render(
        <div onClick={onParentClick}>
          <Button disabled focusableWhenDisabled onClick={onClick}>
            Start voice call
          </Button>
        </div>,
      );

      const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Start voice call' });
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.className).toContain('aria-disabled:opacity-50');

      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
    });

    it('prevents navigation when rendered as a link', () => {
      const onClick = vi.fn();

      render(
        <Button as="a" href="/voice" disabled focusableWhenDisabled onClick={onClick}>
          Start voice call
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Start voice call' });

      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('exposes its tooltip on keyboard focus', async () => {
      render(
        <TooltipProvider delay={0}>
          <Button disabled focusableWhenDisabled tooltip="Set up the integration">
            Start voice call
          </Button>
        </TooltipProvider>,
      );

      const button = screen.getByRole('button', { name: 'Start voice call' });
      button.focus();

      expect(document.activeElement).toBe(button);
      await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Set up the integration'));
    });
  });
});

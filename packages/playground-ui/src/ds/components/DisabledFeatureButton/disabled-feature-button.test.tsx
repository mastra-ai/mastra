// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DisabledFeatureButton } from './disabled-feature-button';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(() => {
  cleanup();
});

describe('DisabledFeatureButton', () => {
  describe('when a feature is unavailable', () => {
    it('exposes one named, disabled, focusable control', () => {
      render(
        <TooltipProvider>
          <DisabledFeatureButton
            icon={<span />}
            label="Traces"
            tooltipContent="Add @mastra/observability to enable Traces."
            docsHref="https://mastra.ai/docs/observability/overview"
          />
        </TooltipProvider>,
      );

      const control = screen.getByRole('button', { name: 'Traces' });
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(control.getAttribute('tabindex')).toBe('0');
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });
});

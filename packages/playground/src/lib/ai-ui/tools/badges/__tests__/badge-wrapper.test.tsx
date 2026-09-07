import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadgeWrapper } from '../badge-wrapper';
import { TraceHighlightProvider } from '@/domains/traces/components/trace-highlight-context';

afterEach(() => cleanup());

describe('BadgeWrapper', () => {
  describe('trace highlight', () => {
    it('reports the tool call id when the badge is opened, but not when it is closed', () => {
      const onToolOpen = vi.fn();
      render(
        <TraceHighlightProvider onToolOpen={onToolOpen}>
          <BadgeWrapper title="Ran tool" toolCallId="tc-1">
            <span>tool output</span>
          </BadgeWrapper>
        </TraceHighlightProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /ran tool/i }));
      expect(onToolOpen).toHaveBeenCalledTimes(1);
      expect(onToolOpen).toHaveBeenCalledWith('tc-1');

      fireEvent.click(screen.getByRole('button', { name: /ran tool/i }));
      expect(onToolOpen).toHaveBeenCalledTimes(1);
    });

    it('opens normally outside a trace highlight provider', () => {
      render(
        <BadgeWrapper title="Ran tool" toolCallId="tc-1">
          <span>tool output</span>
        </BadgeWrapper>,
      );

      fireEvent.click(screen.getByRole('button', { name: /ran tool/i }));
      expect(screen.getByText('tool output')).toBeTruthy();
    });
  });

  it('keeps the body of a badge that cannot be collapsed visible', () => {
    render(
      <BadgeWrapper title="Working" collapsible={false}>
        <span>live output</span>
      </BadgeWrapper>,
    );

    expect(screen.getByText('live output')).toBeTruthy();
  });

  it('hides the body of a collapsible badge until it is opened', () => {
    render(
      <BadgeWrapper title="Ran tool">
        <span>tool output</span>
      </BadgeWrapper>,
    );

    expect(screen.queryByText('tool output')).toBeNull();
  });
});

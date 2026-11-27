// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PanelFrame, SessionPanelToggle } from './panel-frame';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

describe('session panel frame', () => {
  it('puts the subject above the body', () => {
    render(
      <PanelFrame subject={<span>Subject</span>}>
        <span>Body</span>
      </PanelFrame>,
    );
    const subject = screen.getByText('Subject');
    expect(subject.compareDocumentPosition(screen.getByText('Body')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('flips the panel open state', () => {
    const onOpenChange = vi.fn();
    render(
      <TooltipProvider>
        <SessionPanelToggle open onOpenChange={onOpenChange} />
      </TooltipProvider>,
    );
    const toggle = screen.getByRole('button', { name: 'Session panel' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

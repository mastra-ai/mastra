// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepDeck } from './step-deck';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverStub));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function deck(current: number) {
  return (
    <StepDeck current={current} label="New agent steps">
      <StepDeck.Step key="basics" title="Basics">
        <label>
          Name
          <input defaultValue="Kit" />
        </label>
      </StepDeck.Step>
      <StepDeck.Step key="instructions" title="Instructions">
        <label>
          Instructions
          <textarea defaultValue="Ask before changing anything." />
        </label>
      </StepDeck.Step>
    </StepDeck>
  );
}

describe('StepDeck', () => {
  it('focuses the next step and keeps inactive fields out of the accessible view', () => {
    const { rerender } = render(deck(0));
    expect(screen.queryByRole('textbox', { name: 'Instructions' })).toBeNull();
    expect(screen.getByText('Next: Instructions')).toBeTruthy();

    rerender(deck(1));

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Instructions' }));
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Instructions' }).closest('[inert]')).toBeNull();
  });

  it('retains edits when moving forward and back', () => {
    const { rerender } = render(deck(0));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Support' } });

    rerender(deck(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Instructions' }), { target: { value: 'Keep drafts.' } });
    rerender(deck(0));

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' }).value).toBe('Support');
    rerender(deck(1));
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Instructions' }).value).toBe('Keep drafts.');
  });
});

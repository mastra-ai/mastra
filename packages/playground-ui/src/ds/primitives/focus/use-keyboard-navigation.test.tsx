// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';

afterEach(cleanup);

function expectKeyboardNavigation(enabled: boolean) {
  expect(document.documentElement.getAttribute('data-mastra-keyboard-navigation')).toBe(String(enabled));
}

describe('keyboard focus modality', () => {
  it('keeps pointer editing quiet, including typing and moving the caret', () => {
    render(<Input aria-label="Agent name" />);
    const input = screen.getByRole('textbox');
    fireEvent.pointerDown(input, { pointerType: 'mouse' });
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(input);
    expectKeyboardNavigation(false);
  });

  it('shares Tab navigation with portals and removes it on touch without blurring', () => {
    render(
      <>
        <Input aria-label="Agent name" />
        {createPortal(<Input aria-label="Search agents" />, document.body)}
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Search agents' });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    act(() => input.focus());
    expectKeyboardNavigation(true);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expectKeyboardNavigation(true);
    fireEvent.pointerDown(input, { pointerType: 'touch' });
    expectKeyboardNavigation(false);
    expect(document.activeElement).toBe(input);
  });

  it('keeps remaining controls subscribed when another control unmounts', () => {
    const { rerender, unmount } = render(
      <StrictMode>
        <Input aria-label="Persistent" />
        <Input aria-label="Temporary" />
      </StrictMode>,
    );
    fireEvent.keyDown(document, { key: 'Tab' });
    rerender(
      <StrictMode>
        <Input aria-label="Persistent" />
      </StrictMode>,
    );
    expectKeyboardNavigation(true);
    fireEvent.pointerDown(document);
    expectKeyboardNavigation(false);
    unmount();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.documentElement.hasAttribute('data-mastra-keyboard-navigation')).toBe(false);
    render(<Input aria-label="New session" />);
    expectKeyboardNavigation(false);
  });

  it('observes Tab even when a component stops bubbling keyboard events', () => {
    render(
      <div onKeyDown={event => event.stopPropagation()}>
        <Input aria-label="Modal search" />
        <Button>Continue</Button>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    expectKeyboardNavigation(true);
    expect(screen.getByRole('button').textContent).toBe('Continue');
  });
});

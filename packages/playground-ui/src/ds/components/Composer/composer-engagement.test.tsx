// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { Composer, ComposerActions, ComposerActionsDetail, ComposerBox, ComposerInput } from './composer';

afterEach(() => {
  cleanup();
});

function ModelPicker() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        Model
      </button>
      {open && createPortal(<div ref={listRef} role="listbox" aria-label="Models" tabIndex={-1} />, document.body)}
    </>
  );
}

function ChatScreen() {
  return (
    <>
      <p>Transcript</p>
      <button type="button">Transcript link</button>
      <Composer aria-label="Message composer">
        <ComposerBox>
          <ComposerInput aria-label="Message" placeholder="Ask Mastra Code" />
          <ComposerActions>
            <button type="button">Attach</button>
            <ComposerActionsDetail>
              <ModelPicker />
            </ComposerActionsDetail>
          </ComposerActions>
        </ComposerBox>
      </Composer>
    </>
  );
}

const composer = () => screen.getByRole('form', { name: 'Message composer' });

describe('Composer engagement', () => {
  it('stays one line until the input is focused', async () => {
    render(<ChatScreen />);
    expect(composer().dataset.engaged).toBeUndefined();

    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));

    expect(composer().dataset.engaged).toBe('true');
  });

  it('does not open when a one-line action is pressed', async () => {
    render(<ChatScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

    expect(composer().dataset.engaged).toBeUndefined();
  });

  it('closes after a click outside the composer', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));

    await userEvent.click(screen.getByText('Transcript'));

    expect(composer().dataset.engaged).toBeUndefined();
  });

  it('stays open while moving between its own controls', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));

    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));

    expect(composer().dataset.engaged).toBe('true');
  });

  it('stays open while one of its pickers is open', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));
    await userEvent.click(screen.getByRole('button', { name: 'Model' }));

    await userEvent.click(screen.getByRole('listbox', { name: 'Models' }));

    expect(composer().dataset.engaged).toBe('true');
  });

  it('closes when a click outside also dismisses its open picker', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));
    await userEvent.click(screen.getByRole('button', { name: 'Model' }));

    await userEvent.click(screen.getByText('Transcript'));

    expect(screen.queryByRole('listbox', { name: 'Models' })).toBeNull();
    expect(composer().dataset.engaged).toBeUndefined();
  });

  it('closes when focus leaves by keyboard', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));

    await userEvent.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Transcript link' }));
    expect(composer().dataset.engaged).toBeUndefined();
  });
});

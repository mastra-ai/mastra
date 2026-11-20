// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Composer, ComposerActions, ComposerActionsDetail, ComposerBox, ComposerInput } from './composer';

afterEach(() => {
  cleanup();
});

function ChatScreen() {
  const [pickerOpen, setPickerOpen] = useState(false);
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
              <button type="button" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}>
                Model
              </button>
            </ComposerActionsDetail>
          </ComposerActions>
        </ComposerBox>
      </Composer>
      {pickerOpen && <div role="listbox" aria-label="Models" tabIndex={-1} />}
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

  it('closes when focus leaves by keyboard', async () => {
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));

    await userEvent.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Transcript link' }));
    expect(composer().dataset.engaged).toBeUndefined();
  });
});

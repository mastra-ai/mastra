// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AutosaveInput } from './autosave-input';
import type { AutosaveInputProps } from './autosave-input';

afterEach(cleanup);

/** A settings page that keeps what was saved, like a refetch after a mutation would. */
function OrganizationName({
  initial = 'Acme',
  fail,
  ...props
}: Partial<AutosaveInputProps> & { initial?: string; fail?: string }) {
  const [name, setName] = useState(initial);
  const [saves, setSaves] = useState<string[]>([]);
  return (
    <>
      <AutosaveInput
        label="Organization name"
        value={name}
        validate={value => (value.trim() ? undefined : "Name can't be empty.")}
        onSave={async next => {
          await Promise.resolve();
          if (fail) throw new Error(fail);
          setSaves(s => [...s, next]);
          setName(next);
        }}
        {...props}
      />
      <output aria-label="Saves">{saves.join(',')}</output>
      <button type="button">Elsewhere</button>
    </>
  );
}

const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Organization name' });
const saves = () => screen.getByLabelText('Saves').textContent;

describe('AutosaveInput', () => {
  it('saves a changed name when you leave the field, then confirms it', async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.clear(input());
    await user.type(input(), 'Acme Labs');
    expect(saves()).toBe('');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() => expect(saves()).toBe('Acme Labs'));
    expect(screen.getByText('Organization name saved').getAttribute('role')).toBe('status');
  });

  it('saves once on Enter, even though leaving the field afterwards would save too', async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.type(input(), ' Labs{Enter}');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() => expect(saves()).toBe('Acme Labs'));
  });

  it("doesn't save when you leave without changing anything", async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.click(input());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(saves()).toBe('');
  });

  it('puts the saved name back on Escape', async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.type(input(), ' Labs{Escape}');

    expect(input().value).toBe('Acme');
    expect(document.activeElement).toBe(input());
  });

  it('explains an invalid name instead of saving it, and keeps what you typed', async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.clear(input());
    await user.keyboard('{Enter}');

    expect(saves()).toBe('');
    expect(input().value).toBe('');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    const describedBy = document.getElementById(input().getAttribute('aria-describedby') ?? '');
    expect(describedBy?.textContent).toBe("Name can't be empty.");
    expect(screen.getByRole('button', { name: 'Organization name error' })).toBeDefined();
  });

  it('shows why a save failed and keeps the draft to retry', async () => {
    const user = userEvent.setup();
    render(<OrganizationName fail="You don't have permission to rename this organization." />);

    await user.type(input(), ' Labs{Enter}');

    await waitFor(() => expect(input().getAttribute('aria-invalid')).toBe('true'));
    const describedBy = document.getElementById(input().getAttribute('aria-describedby') ?? '');
    expect(describedBy?.textContent).toBe("You don't have permission to rename this organization.");
    expect(input().value).toBe('Acme Labs');
  });

  it('clears the error as soon as you edit again', async () => {
    const user = userEvent.setup();
    render(<OrganizationName />);

    await user.clear(input());
    await user.keyboard('{Enter}');
    await user.type(input(), 'A');

    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Organization name error' })).toBeNull();
  });

  it('shows a new saved value from elsewhere, replacing the draft', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AutosaveInput label="Organization name" value="Acme" onSave={async () => {}} />);

    await user.type(input(), ' Labs');
    rerender(<AutosaveInput label="Organization name" value="Acme Corp" onSave={async () => {}} />);

    expect(input().value).toBe('Acme Corp');
  });
});

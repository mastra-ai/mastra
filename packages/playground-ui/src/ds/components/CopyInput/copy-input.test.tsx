// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CopyInput } from './copy-input';

afterEach(cleanup);

describe('CopyInput', () => {
  it('shows the value read-only, with a copy button named after it', () => {
    render(<CopyInput label="project ID" value="9141280b" />);

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'project ID' });
    expect(input.value).toBe('9141280b');
    expect(input.readOnly).toBe(true);
    expect(screen.getByRole('button', { name: 'Copy project ID' })).toBeDefined();
  });

  it('disables the copy button with the input', () => {
    render(<CopyInput label="project ID" value="9141280b" disabled />);

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'project ID' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Copy project ID' }).disabled).toBe(true);
  });
});

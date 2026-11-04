// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CopyInput } from './copy-input';

afterEach(cleanup);

describe('CopyInput', () => {
  it('shows the value read-only, with a copy button named after it', () => {
    render(<CopyInput label="project ID" value="9141280b" />);

    const input = screen.getByRole('textbox', { name: 'project ID' }) as HTMLInputElement;
    expect(input.value).toBe('9141280b');
    expect(input.readOnly).toBe(true);
    expect(screen.getByRole('button', { name: 'Copy project ID' })).toBeDefined();
  });
});

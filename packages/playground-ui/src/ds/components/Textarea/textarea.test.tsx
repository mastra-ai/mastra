// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

afterEach(() => {
  cleanup();
});

describe('Textarea', () => {
  it('supports an outline variant without an initial filled background', () => {
    render(<Textarea variant="outline" placeholder="Description" />);

    const textarea = screen.getByPlaceholderText('Description');
    expect(textarea.className).toContain('bg-transparent');
    expect(textarea.className).toContain('rounded-xl');
    expect(textarea.className).not.toContain('bg-surface-overlay-soft');
  });
});

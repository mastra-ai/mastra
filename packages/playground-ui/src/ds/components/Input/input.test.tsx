// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('uses the shared foreground text color at rest', () => {
    render(<Input placeholder="Name" />);

    const cls = screen.getByPlaceholderText('Name').className;
    expect(cls).toContain('text-foreground');
    expect(cls).toContain('placeholder:text-muted-foreground');
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Label } from './label';

afterEach(() => {
  cleanup();
});

describe('Label', () => {
  it('renders its text content', () => {
    render(<Label>Email address</Label>);

    expect(screen.getByText('Email address')).toBeDefined();
  });

  it('renders a native <label> element', () => {
    render(<Label>Name</Label>);

    expect(screen.getByText('Name').tagName).toBe('LABEL');
  });

  it('associates with a control via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    );

    const label = screen.getByText('Email') as HTMLLabelElement;
    expect(label.htmlFor).toBe('email');
    expect(label.control).toBe(screen.getByRole('textbox'));
  });

  it('merges a custom className with the base classes', () => {
    render(<Label className="custom-label">Username</Label>);

    const label = screen.getByText('Username');
    expect(label.classList.contains('custom-label')).toBe(true);
    expect(label.classList.contains('text-sm')).toBe(true);
  });

  it('forwards a ref to the underlying <label> element', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Ref label</Label>);

    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current?.textContent).toBe('Ref label');
  });
});

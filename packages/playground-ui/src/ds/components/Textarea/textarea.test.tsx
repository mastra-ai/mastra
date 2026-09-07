// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
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

  it.each([
    ['sm', 'text-ui-sm'],
    ['md', 'text-ui-md'],
    ['default', 'text-ui-md'],
    ['lg', 'text-ui-lg'],
  ] as const)('reads at the %s size', (size, expected) => {
    render(<Textarea size={size} placeholder="Description" />);

    expect(screen.getByPlaceholderText('Description').className).toContain(expected);
  });

  it('reads at the medium size by default', () => {
    render(<Textarea placeholder="Description" />);

    expect(screen.getByPlaceholderText('Description').className).toContain('text-ui-md');
  });

  it('drops its own chrome in the unstyled variant', () => {
    render(<Textarea variant="unstyled" placeholder="Description" />);

    expect(screen.getByPlaceholderText('Description').className).not.toContain('rounded-xl');
  });

  it('marks itself invalid and outlines the error', () => {
    render(<Textarea error placeholder="Description" />);

    const textarea = screen.getByPlaceholderText('Description');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.className).toContain('border-error');
  });

  it('carries no error outline when it is valid', () => {
    render(<Textarea placeholder="Description" />);

    expect(screen.getByPlaceholderText('Description').className).not.toContain('border-error');
  });

  it('keeps a caller class alongside its own', () => {
    render(<Textarea className="my-own-class" placeholder="Description" />);

    const textarea = screen.getByPlaceholderText('Description');
    expect(textarea.className).toContain('my-own-class');
    expect(textarea.className).toContain('min-h-20');
  });

  it('forwards a test id and the rest of its props', () => {
    render(<Textarea testId="description-field" placeholder="Description" rows={7} readOnly />);

    const textarea = screen.getByTestId('description-field');
    expect(textarea.getAttribute('rows')).toBe('7');
    expect(textarea.hasAttribute('readonly')).toBe(true);
    // The variant props never reach the DOM.
    expect(textarea.hasAttribute('size')).toBe(false);
    expect(textarea.hasAttribute('variant')).toBe(false);
    expect(textarea.hasAttribute('testId')).toBe(false);
  });

  it('hands its ref to the element itself', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} placeholder="Description" />);

    expect(ref.current).toBe(screen.getByPlaceholderText('Description'));
  });
});

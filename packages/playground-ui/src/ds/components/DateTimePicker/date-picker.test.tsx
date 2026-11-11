// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DatePicker } from './date-picker';

const rootClasses = (container: HTMLElement) =>
  (container.querySelector('.rdp-root') as HTMLElement).className.split(/\s+/);

describe('DatePicker', () => {
  it('fills its container by default', () => {
    const { container } = render(<DatePicker mode="single" />);
    expect(rootClasses(container)).toContain('w-full');
  });

  it('lets a caller width class replace the default', () => {
    const { container } = render(<DatePicker mode="single" className="w-fit" />);
    const classes = rootClasses(container);
    expect(classes).toContain('w-fit');
    expect(classes).not.toContain('w-full');
  });
});

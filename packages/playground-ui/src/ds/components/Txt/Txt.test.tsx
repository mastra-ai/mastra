// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Txt } from './Txt';

afterEach(cleanup);

describe('Txt', () => {
  it('forwards an object ref to the default paragraph and clears it on unmount', () => {
    const ref = createRef<HTMLParagraphElement>();
    const { unmount } = render(<Txt ref={ref}>Description</Txt>);

    expect(ref.current).toBe(screen.getByText('Description'));
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement);

    unmount();

    expect(ref.current).toBeNull();
  });

  it('preserves native label attributes and callback ref cleanup when the tag changes', () => {
    const releaseLabel = vi.fn();
    const labelRef = vi.fn(() => releaseLabel);
    const headingRef = createRef<HTMLHeadingElement>();
    const { rerender } = render(
      <>
        <Txt as="label" htmlFor="name" ref={labelRef}>
          Name
        </Txt>
        <input id="name" />
      </>,
    );

    expect(screen.getByLabelText('Name')).toBe(screen.getByRole('textbox'));
    expect(labelRef).toHaveBeenCalledWith(screen.getByText('Name'));

    rerender(
      <Txt as="h2" ref={headingRef}>
        Name
      </Txt>,
    );

    expect(releaseLabel).toHaveBeenCalledOnce();
    expect(headingRef.current).toBe(screen.getByRole('heading', { name: 'Name', level: 2 }));
  });
});

// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SegmentedName } from './segmented-name';

describe('SegmentedName', () => {
  afterEach(() => cleanup());

  it('joins the parts with a separator screen readers skip', () => {
    const { container } = render(<SegmentedName parts={['openai', 'gpt-5']} />);
    expect(container.textContent).toBe('openai›gpt-5');
    expect(container.querySelector('[aria-hidden]')?.textContent).toBe('›');
  });

  it('shows a single part without a separator', () => {
    const { container } = render(<SegmentedName parts={['gpt-5']} />);
    expect(container.textContent).toBe('gpt-5');
  });
});

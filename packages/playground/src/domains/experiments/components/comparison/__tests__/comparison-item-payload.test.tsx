import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComparisonItemPayload } from '../comparison-item-payload';

const clip = () => document.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]');
const box = () => document.querySelector<HTMLElement>('[data-slot="collapsible-box"]');
const mockScrollHeight = (height: number) =>
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(height);

describe('ComparisonItemPayload', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the payload by default, without any toggle', () => {
    render(<ComparisonItemPayload label="Input" value={{ question: 'What is the capital of France?' }} />);

    const region = screen.getByRole('region', { name: 'Input' });
    expect(within(region).getByText(/What is the capital of France/)).toBeTruthy();
  });

  it('renders a string payload as markdown', () => {
    render(<ComparisonItemPayload label="Input" value={'Answer with **one word** only'} />);

    const region = screen.getByRole('region', { name: 'Input' });
    expect(within(region).getByText('one word').tagName).toBe('STRONG');
  });

  it('renders a non-string payload as JSON', () => {
    render(<ComparisonItemPayload label="Ground truth" value={{ answer: 'Paris' }} />);

    const region = screen.getByRole('region', { name: 'Ground truth' });
    expect(region.querySelector('pre')?.textContent).toBe('{\n  "answer": "Paris"\n}');
  });

  it('renders nothing when there is no payload', () => {
    const { container } = render(<ComparisonItemPayload label="Input" value={null} />);
    expect(container.innerHTML).toBe('');
  });

  describe('when the payload is long', () => {
    it('clips it with a fade and expands it on click', () => {
      mockScrollHeight(1000);
      render(<ComparisonItemPayload label="Input" value={'line\n\n'.repeat(50)} />);

      expect(box()?.hasAttribute('data-clipped')).toBe(true);
      expect(clip()?.style.maxHeight).toBe('160px');
      expect(clip()?.classList.contains('mask-b-from-60%')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

      expect(box()?.hasAttribute('data-clipped')).toBe(false);
      expect(clip()?.style.maxHeight).toBe('');
    });
  });

  describe('when the payload is short', () => {
    it('neither clips nor offers to expand it', () => {
      mockScrollHeight(40);
      render(<ComparisonItemPayload label="Input" value="short" />);

      expect(box()?.hasAttribute('data-clipped')).toBe(false);
      expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    });
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { DataCodeSection } from './data-code-section';

// CodeMirror needs real layout, so render a stand-in. The match counter and navigation are driven
// by the pure `findMatchRanges`/`getNextMatchIndex` helpers over `codeStr`, not by the editor view,
// so the wiring is fully observable without a live editor (scroll/highlight are a no-op here).
vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid="mock-code-mirror" />,
}));

afterEach(() => {
  cleanup();
});

// "alpha" appears three times (case-insensitive), so the counter should read "/3".
const CODE = 'alpha BETA Alpha gamma ALPHA';

function renderSection() {
  render(
    <TooltipProvider>
      <DataCodeSection title="Input" codeStr={CODE} />
    </TooltipProvider>,
  );
}

function openSearch() {
  // The field starts minimized as an icon button labelled with the field label.
  fireEvent.click(screen.getByRole('button', { name: 'Search code' }));
  return screen.getByPlaceholderText('Search...');
}

describe('DataCodeSection search navigation', () => {
  it('shows a "current / total" counter once a query matches', () => {
    renderSection();
    const input = openSearch();

    expect(screen.queryByText('1/3')).toBeNull();
    fireEvent.change(input, { target: { value: 'alpha' } });
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('cycles forward with Enter and wraps around at the end', () => {
    renderSection();
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'alpha' } });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('3/3')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('cycles backward with Shift+Enter and wraps around at the start', () => {
    renderSection();
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'alpha' } });

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('steps through matches with the next and previous buttons', () => {
    renderSection();
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'alpha' } });

    const next = screen.getByRole('button', { name: 'Next match' });
    const prev = screen.getByRole('button', { name: 'Previous match' });
    // Buttons must not submit a surrounding form.
    expect(next.getAttribute('type')).toBe('button');
    expect(prev.getAttribute('type')).toBe('button');

    fireEvent.click(next);
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.click(prev);
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('resyncs the counter when the document text changes while a search is active', () => {
    const { rerender } = render(
      <TooltipProvider>
        <DataCodeSection title="Input" codeStr={CODE} />
      </TooltipProvider>,
    );
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'alpha' } });
    expect(screen.getByText('1/3')).toBeTruthy();

    // Selecting a different span swaps codeStr; the counter must reflect the new document.
    rerender(
      <TooltipProvider>
        <DataCodeSection title="Input" codeStr="alpha beta gamma" />
      </TooltipProvider>,
    );
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('shows "0/0" and disables navigation when nothing matches', () => {
    renderSection();
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'zzz' } });

    expect(screen.getByText('0/0')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next match' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Previous match' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

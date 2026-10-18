// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { highlight } from '../CodeEditor/highlight';
import { DataCodeSection } from './data-code-section';

vi.mock('../CodeEditor/highlight', () => ({ highlight: vi.fn() }));

const before = JSON.stringify({ city: 'Paris', unit: 'C' }, null, 2);
const after = JSON.stringify({ city: 'Lyon', unit: 'C' }, null, 2);

beforeEach(() => {
  vi.mocked(highlight).mockImplementation(async code => code.split('\n').map(line => [{ content: line }]));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.mocked(highlight).mockReset();
});

describe('DataCodeSection', () => {
  it('renders JSON as Shiki tokens instead of a CodeMirror editor', async () => {
    const { container } = render(<DataCodeSection title="Input" codeStr={before} />);

    await vi.waitFor(() => expect(container.querySelector('.shiki-token')).not.toBeNull());
    expect(container.querySelector('.cm-editor')).toBeNull();
  });

  describe('when a diff is given', () => {
    it('marks changed lines as removed on side a and added on side b', () => {
      const a = render(<DataCodeSection title="Input" codeStr={before} diff={{ against: after, side: 'a' }} />);
      expect(a.container.querySelectorAll('.code-diff-removed')).toHaveLength(1);
      expect(a.container.querySelector('.code-diff-added')).toBeNull();
      cleanup();

      const b = render(<DataCodeSection title="Input" codeStr={after} diff={{ against: before, side: 'b' }} />);
      expect(b.container.querySelectorAll('.code-diff-added')).toHaveLength(1);
    });
  });

  describe('when no diff is given', () => {
    it('renders no highlight', () => {
      const { container } = render(<DataCodeSection title="Input" codeStr={before} />);
      expect(container.querySelector('.code-diff-removed, .code-diff-added')).toBeNull();
    });
  });

  describe('when searching', () => {
    it('highlights the matching line and scrolls it into view', () => {
      const { container } = render(<DataCodeSection title="Input" codeStr={before} />);

      fireEvent.click(screen.getByRole('button', { name: 'Search code' }));
      fireEvent.change(screen.getByLabelText('Search code'), { target: { value: 'PARIS' } });

      const matches = container.querySelectorAll('.code-search-match');
      expect(matches).toHaveLength(1);
      expect(matches[0]?.textContent).toContain('Paris');
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });
});

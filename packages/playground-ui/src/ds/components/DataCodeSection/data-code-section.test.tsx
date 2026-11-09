// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataCodeSection } from './data-code-section';

const before = JSON.stringify({ city: 'Paris', unit: 'C' }, null, 2);
const after = JSON.stringify({ city: 'Lyon', unit: 'C' }, null, 2);

function editorView(container: HTMLElement) {
  const editor = container.querySelector<HTMLElement>('.cm-editor');
  if (!editor) throw new Error('editor not rendered');
  const view = EditorView.findFromDOM(editor);
  if (!view) throw new Error('no EditorView for the editor');
  return view;
}

afterEach(() => {
  cleanup();
});

describe('DataCodeSection', () => {
  it('renders JSON in a read-only editor with a fold gutter', () => {
    const { container } = render(<DataCodeSection title="Input" codeStr={before} />);

    const view = editorView(container);
    expect(view.state.doc.toString()).toBe(before);
    expect(view.state.readOnly).toBe(true);
    expect(container.querySelector('.cm-foldGutter')).not.toBeNull();
  });

  describe('when a diff is given', () => {
    it('marks changed lines as removed on side a and added on side b', () => {
      const a = render(<DataCodeSection title="Input" codeStr={before} diff={{ against: after, side: 'a' }} />);
      const removed = a.container.querySelectorAll('.code-diff-removed');
      expect(removed).toHaveLength(1);
      expect(removed[0]?.textContent).toContain('Paris');
      expect(a.container.querySelector('.code-diff-added')).toBeNull();
      cleanup();

      const b = render(<DataCodeSection title="Input" codeStr={after} diff={{ against: before, side: 'b' }} />);
      const added = b.container.querySelectorAll('.code-diff-added');
      expect(added).toHaveLength(1);
      expect(added[0]?.textContent).toContain('Lyon');
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
      const dispatch = vi.spyOn(editorView(container), 'dispatch');

      fireEvent.click(screen.getByRole('button', { name: 'Search code' }));
      fireEvent.change(screen.getByLabelText('Search code'), { target: { value: 'PARIS' } });

      const matches = container.querySelectorAll('.code-search-match');
      expect(matches).toHaveLength(1);
      expect(matches[0]?.textContent).toContain('Paris');
      const scrollEffect = EditorView.scrollIntoView(0).type;
      const scrolled = dispatch.mock.calls
        .flat()
        .some(spec => [spec.effects ?? []].flat().some(effect => effect.type === scrollEffect));
      expect(scrolled).toBe(true);
    });
  });
});

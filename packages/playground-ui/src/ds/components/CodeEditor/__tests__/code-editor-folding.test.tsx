// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeEditor } from '../code-editor';

afterEach(() => {
  cleanup();
});

const renderJson = () => {
  const { container } = render(<CodeEditor data={{ a: { b: 1 }, list: [1, 2] }} showCopyButton={false} />);
  const content = () => container.querySelector<HTMLElement>('.cm-content')?.textContent ?? '';
  // The gutter keeps a hidden spacer marker to reserve its width; only visible markers belong to lines.
  const markers = () =>
    Array.from(container.querySelectorAll<HTMLElement>('.cm-fold-marker')).filter(
      marker => (marker.parentElement as HTMLElement).style.visibility !== 'hidden',
    );
  const markerAt = (index: number) => {
    const marker = markers()[index];
    if (!marker) throw new Error(`No fold marker at index ${index}`);
    return marker;
  };
  return { container, content, markers, markerAt };
};

// jsdom has no layout, so CodeMirror can't read a marker's bounding rect. It still positions gutter elements with
// inline heights/margins from its height map, and a click on the gutter itself resolves the line from clientY —
// so click the gutter at the marker's vertical centre, through CodeMirror's real gutter handler.
const clickMarker = (marker: HTMLElement) => {
  const element = marker.parentElement as HTMLElement;
  const gutter = element.parentElement as HTMLElement;
  let top = 0;
  for (let sibling = gutter.firstElementChild as HTMLElement | null; sibling;) {
    top += parseFloat(sibling.style.marginTop || '0');
    if (sibling === element) break;
    top += parseFloat(sibling.style.height || '0');
    sibling = sibling.nextElementSibling as HTMLElement | null;
  }
  fireEvent.click(gutter, { clientY: top + parseFloat(element.style.height) / 2 });
};

describe('CodeEditor folding', () => {
  describe('when it shows nested JSON', () => {
    it('renders a single fold gutter', async () => {
      const { container } = renderJson();

      await waitFor(() => expect(container.querySelector('.cm-editor')).not.toBeNull());
      expect(container.querySelectorAll('.cm-foldGutter')).toHaveLength(1);
    });

    it('shows an open square toggle on every foldable line', async () => {
      const { markers } = renderJson();

      await waitFor(() => expect(markers().length).toBeGreaterThanOrEqual(3));
      for (const marker of markers()) {
        expect(marker.dataset.state).toBe('open');
        expect(marker.textContent).toBe('−');
      }
    });
  });

  describe('when the toggle next to a nested object is clicked', () => {
    it('collapses the object behind a placeholder', async () => {
      const { container, content, markers, markerAt } = renderJson();
      await waitFor(() => expect(markers().length).toBeGreaterThanOrEqual(3));

      // Markers are rendered top to bottom: the root `{`, then `"a": {`, then `"list": [`.
      clickMarker(markerAt(1));

      await waitFor(() => expect(container.querySelector('.cm-foldPlaceholder')).not.toBeNull());
      expect(content()).not.toContain('"b": 1');
      expect(content()).toContain('"list"');
      expect(markerAt(1).dataset.state).toBe('closed');
      expect(markerAt(1).textContent).toBe('+');
    });
  });

  describe('when the toggle of a collapsed object is clicked again', () => {
    it('brings the content back', async () => {
      const { container, content, markers, markerAt } = renderJson();
      await waitFor(() => expect(markers().length).toBeGreaterThanOrEqual(3));

      clickMarker(markerAt(1));
      await waitFor(() => expect(markerAt(1).dataset.state).toBe('closed'));

      clickMarker(markerAt(1));

      await waitFor(() => expect(content()).toContain('"b": 1'));
      expect(container.querySelector('.cm-foldPlaceholder')).toBeNull();
      expect(markerAt(1).dataset.state).toBe('open');
    });
  });
});

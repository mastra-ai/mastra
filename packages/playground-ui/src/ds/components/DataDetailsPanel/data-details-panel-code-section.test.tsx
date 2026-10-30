// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataDetailsPanelCodeSection } from './data-details-panel-code-section';

afterEach(cleanup);

describe('DataDetailsPanelCodeSection', () => {
  describe('when given JSON', () => {
    const codeStr = JSON.stringify({ ok: true, nested: { a: 1 } }, null, 2);

    it('shows the exact JSON in a read-only editor', () => {
      const { container } = render(<DataDetailsPanelCodeSection title="Response" codeStr={codeStr} />);

      const editor = container.querySelector<HTMLElement>('.cm-editor');
      const view = editor ? EditorView.findFromDOM(editor) : null;
      expect(view?.state.doc.toString()).toBe(codeStr);
      expect(view?.state.readOnly).toBe(true);
    });

    it('offers fold toggles for its objects', () => {
      const { container } = render(<DataDetailsPanelCodeSection title="Response" codeStr={codeStr} />);

      expect(container.querySelectorAll('.cm-foldGutter')).toHaveLength(1);
      expect(container.querySelector('.cm-fold-marker[data-state="open"]')).not.toBeNull();
    });
  });
});

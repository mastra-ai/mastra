// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeEditor } from '../code-editor';

afterEach(() => {
  cleanup();
});

describe('CodeEditor styles', () => {
  it('removes the focused editor outline from the embedded surface', () => {
    const { container } = render(<CodeEditor value="embedded content" showCopyButton={false} variant="embedded" />);
    const editor = container.querySelector<HTMLElement>('.cm-editor');

    if (!editor) {
      throw new Error('Expected CodeMirror editor to render.');
    }

    editor.classList.add('cm-focused');

    expect(getComputedStyle(editor).outline).toBe('none');
  });
});

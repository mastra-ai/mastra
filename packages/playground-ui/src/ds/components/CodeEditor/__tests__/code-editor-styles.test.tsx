// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeEditor } from '../code-editor';

afterEach(() => {
  cleanup();
});

describe('CodeEditor styles', () => {
  const renderFocusedEditor = async (variant: 'default' | 'embedded') => {
    const { container } = render(<CodeEditor value={`${variant} content`} showCopyButton={false} variant={variant} />);
    const editor = container.querySelector<HTMLElement>('.cm-editor');
    const textbox = container.querySelector<HTMLElement>('[role="textbox"]');

    if (!editor) {
      throw new Error('Expected CodeMirror editor to render.');
    }

    if (!textbox) {
      throw new Error('Expected CodeMirror textbox to render.');
    }

    textbox.focus();

    expect(document.activeElement).toBe(textbox);

    await waitFor(() => {
      const editorStyle = getComputedStyle(editor);
      expect(editorStyle.outline).toBe('none');
      expect(editorStyle.outlineStyle).not.toMatch(/dashed|dotted/);
    });

    const textboxStyle = getComputedStyle(textbox);
    expect(textboxStyle.outlineStyle).not.toMatch(/dashed|dotted/);
  };

  it('removes the focused editor outline from the default surface', async () => {
    await renderFocusedEditor('default');
  });

  it('removes the focused editor outline from the embedded surface', async () => {
    await renderFocusedEditor('embedded');
  });
});

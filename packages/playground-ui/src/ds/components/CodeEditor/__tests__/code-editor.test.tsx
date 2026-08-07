// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeEditor } from '../code-editor';

const codeMirrorProps = vi.hoisted(() => [] as Array<{ extensions: unknown[] }>);

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: { extensions: unknown[] }) => {
    codeMirrorProps.push(props);
    return <div data-testid="mock-code-mirror" />;
  },
}));

afterEach(() => {
  cleanup();
  codeMirrorProps.length = 0;
});

describe('CodeEditor', () => {
  it('wraps long lines by default', () => {
    render(<CodeEditor value="long content" showCopyButton={false} />);

    expect(codeMirrorProps.at(-1)?.extensions).toContain(EditorView.lineWrapping);
  });

  it('can preserve long lines behind horizontal scrolling', () => {
    render(<CodeEditor value="long content" showCopyButton={false} lineWrapping={false} />);

    expect(codeMirrorProps.at(-1)?.extensions).not.toContain(EditorView.lineWrapping);
  });
});

// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { cleanup, render, screen } from '@testing-library/react';
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

const lastProps = () => codeMirrorProps.at(-1) as (Record<string, unknown> & { extensions: unknown[] }) | undefined;

describe('CodeEditor — what it shows', () => {
  it('shows the value it was given', () => {
    render(<CodeEditor value="const a = 1" showCopyButton={false} />);

    expect(lastProps()?.value).toBe('const a = 1');
  });

  it('pretty-prints data over a value', () => {
    render(<CodeEditor data={{ a: 1 }} value="ignored" showCopyButton={false} />);

    expect(lastProps()?.value).toBe('{\n  "a": 1\n}');
  });

  it('pretty-prints an array of records too', () => {
    render(<CodeEditor data={[{ a: 1 }]} showCopyButton={false} />);

    expect(lastProps()?.value).toBe('[\n  {\n    "a": 1\n  }\n]');
  });

  it('shows nothing when it was given nothing', () => {
    render(<CodeEditor showCopyButton={false} />);

    expect(lastProps()?.value).toBe('');
  });

  it('names itself for a screen reader', () => {
    render(<CodeEditor value="x" showCopyButton={false} />);

    expect(lastProps()?.['aria-label']).toBe('Code editor');
  });
});

describe('CodeEditor — the copy button', () => {
  it('offers a copy button by default, carrying what is on screen', () => {
    render(<CodeEditor data={{ a: 1 }} />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
  });

  it('leaves it out when the caller asks', () => {
    render(<CodeEditor value="x" showCopyButton={false} />);

    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });
});

describe('CodeEditor — language extensions', () => {
  const extensionCount = () => lastProps()?.extensions.length ?? 0;

  it('adds one language extension for json', () => {
    render(<CodeEditor value="{}" showCopyButton={false} lineWrapping={false} />);
    const withJson = extensionCount();

    cleanup();

    render(<CodeEditor value="{}" showCopyButton={false} lineWrapping={false} language="text" />);

    expect(withJson).toBe(extensionCount() + 1);
  });

  it('adds one language extension for markdown', () => {
    render(<CodeEditor value="# hi" showCopyButton={false} lineWrapping={false} language="markdown" />);
    const withMarkdown = extensionCount();

    cleanup();

    render(<CodeEditor value="# hi" showCopyButton={false} lineWrapping={false} language="text" />);

    expect(withMarkdown).toBe(extensionCount() + 1);
  });

  it('highlights placeholders only when asked to', () => {
    render(<CodeEditor value="x" showCopyButton={false} language="markdown" />);
    const plain = extensionCount();

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} language="markdown" highlightVariables />);

    expect(extensionCount()).toBe(plain + 1);
  });

  it('highlights placeholders in markdown only', () => {
    render(<CodeEditor value="x" showCopyButton={false} language="json" />);
    const plainJson = extensionCount();

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} language="json" highlightVariables />);

    // Placeholders mean nothing outside prose, so json is left alone.
    expect(extensionCount()).toBe(plainJson);
  });

  it('completes placeholders from a schema, in markdown only', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } } as const;

    render(<CodeEditor value="x" showCopyButton={false} language="markdown" />);
    const plain = extensionCount();

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} language="markdown" schema={schema} />);
    expect(extensionCount()).toBe(plain + 1);

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} language="json" />);
    const plainJson = extensionCount();

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} language="json" schema={schema} />);
    expect(extensionCount()).toBe(plainJson);
  });

  it('locks the document only when told it is not editable', () => {
    render(<CodeEditor value="x" showCopyButton={false} />);
    const editable = extensionCount();

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} editable={false} />);
    expect(extensionCount()).toBe(editable + 1);
    expect(lastProps()?.editable).toBe(false);

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} editable />);
    expect(extensionCount()).toBe(editable);
  });
});

describe('CodeEditor — passing its settings through', () => {
  it('shows line numbers unless the caller turns them off', () => {
    render(<CodeEditor value="x" showCopyButton={false} />);
    expect(lastProps()?.basicSetup).toEqual({ lineNumbers: true });

    cleanup();

    render(<CodeEditor value="x" showCopyButton={false} lineNumbers={false} />);
    expect(lastProps()?.basicSetup).toEqual({ lineNumbers: false });
  });

  it('hands over the placeholder, focus and change handler it was given', () => {
    const onChange = vi.fn();
    render(<CodeEditor value="x" showCopyButton={false} placeholder="Type here" autoFocus onChange={onChange} />);

    expect(lastProps()?.placeholder).toBe('Type here');
    expect(lastProps()?.autoFocus).toBe(true);
    expect(lastProps()?.onChange).toBe(onChange);
  });

  it('fills the space it is given', () => {
    render(<CodeEditor value="x" showCopyButton={false} />);

    expect(lastProps()?.height).toBe('100%');
    expect(lastProps()?.style).toEqual({ height: '100%' });
  });

  it('takes the frame the caller asks for', () => {
    const { container } = render(<CodeEditor value="x" showCopyButton={false} />);
    expect((container.firstElementChild as HTMLElement).classList.contains('border-border1')).toBe(true);

    cleanup();

    const embedded = render(<CodeEditor value="x" showCopyButton={false} variant="embedded" />);
    const root = embedded.container.firstElementChild as HTMLElement;
    expect(root.classList.contains('border-none')).toBe(true);
    expect(root.classList.contains('border-border1')).toBe(false);
  });

  it('rebuilds its extensions when the language changes', () => {
    const { rerender } = render(<CodeEditor value="x" showCopyButton={false} lineWrapping={false} language="text" />);
    const plain = lastProps()?.extensions;

    rerender(<CodeEditor value="x" showCopyButton={false} lineWrapping={false} language="markdown" />);

    expect(lastProps()?.extensions).not.toBe(plain);
    expect(lastProps()?.extensions.length).toBe((plain?.length ?? 0) + 1);
  });

  it('keeps a caller class alongside its own, and passes the rest through', () => {
    const { container } = render(
      <CodeEditor value="x" showCopyButton={false} className="my-own-class" data-testid="editor" />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('my-own-class')).toBe(true);
    expect(root.classList.contains('relative')).toBe(true);
    expect(screen.getByTestId('editor')).toBeTruthy();
  });
});

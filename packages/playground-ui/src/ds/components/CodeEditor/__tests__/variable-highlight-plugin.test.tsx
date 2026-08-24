// @vitest-environment jsdom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';

import { variableHighlight } from '../variable-highlight-extension';

const views: EditorView[] = [];

const mount = (doc: string) => {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [variableHighlight] }),
    parent,
  });
  views.push(view);
  return { view, parent };
};

const highlighted = (parent: HTMLElement) =>
  [...parent.querySelectorAll('.cm-variable-highlight')].map(node => node.textContent);

afterEach(() => {
  views.splice(0).forEach(view => {
    view.destroy();
    view.dom.parentElement?.remove();
  });
});

describe('variableHighlight', () => {
  it('marks every placeholder in the document it opens with', () => {
    const { parent } = mount('Hello {{userName}} at {{company.name}}.');

    expect(highlighted(parent)).toEqual(['{{userName}}', '{{company.name}}']);
  });

  it('leaves text that is not a placeholder alone', () => {
    const { parent } = mount('Hello {notAVariable} and {{1invalid}}.');

    expect(highlighted(parent)).toEqual([]);
  });

  it('marks a placeholder the reply types out afterwards', () => {
    const { view, parent } = mount('Hello ');

    expect(highlighted(parent)).toEqual([]);

    view.dispatch({ changes: { from: view.state.doc.length, insert: '{{userName}}' } });

    expect(highlighted(parent)).toEqual(['{{userName}}']);
  });

  it('drops the mark when the placeholder is edited away', () => {
    const { view, parent } = mount('Hello {{userName}}');

    expect(highlighted(parent)).toEqual(['{{userName}}']);

    view.dispatch({ changes: { from: 6, to: view.state.doc.length, insert: 'there' } });

    expect(highlighted(parent)).toEqual([]);
  });
});

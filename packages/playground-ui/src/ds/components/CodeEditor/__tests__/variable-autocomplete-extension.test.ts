// @vitest-environment jsdom
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { createVariableCompletionSource } from '../variable-autocomplete-extension';

const source = createVariableCompletionSource([
  { path: 'user', type: 'object' },
  { path: 'user.name', type: 'string' },
]);

function accept(doc: string, cursor: number, label: string): string {
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: cursor } }) });
  const result = source(new CompletionContext(view.state, cursor, true));
  const option = result?.options.find(o => o.label === label);
  if (!result || typeof option?.apply !== 'function') throw new Error(`No completion for ${label}`);
  option.apply(view, option, result.from, cursor);
  const text = view.state.doc.toString();
  view.destroy();
  return text;
}

describe('variable autocomplete', () => {
  describe('when completing at the end of a new placeholder', () => {
    it('appends the closing braces', () => {
      expect(accept('Hi {{us', 7, 'user.name')).toBe('Hi {{user.name}}');
    });
  });

  describe('when completing inside an existing placeholder', () => {
    it('replaces the whole identifier and keeps a single closing pair', () => {
      expect(accept('Hi {{user.nam}}!', 7, 'user.name')).toBe('Hi {{user.name}}!');
    });
  });
});

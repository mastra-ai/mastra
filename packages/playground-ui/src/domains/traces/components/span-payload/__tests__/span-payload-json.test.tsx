// @vitest-environment jsdom
import { foldedRanges, unfoldEffect } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanPayloadJson } from '../span-payload-json';

afterEach(cleanup);

const tool = (index: number) => ({
  type: 'function',
  name: `tool_${index}`,
  description: 'Looks something up. '.repeat(20),
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'What to look up' }, limit: { type: 'number' } },
    required: ['query'],
  },
});

/** Shaped like a model span's attributes: a few scalars around a tools list tens of kilobytes long. */
const attributes = {
  model: 'gpt-5-mini',
  parameters: { temperature: 0 },
  availableTools: Array.from({ length: 22 }, (_, index) => `tool_${index}`),
  tools: Array.from({ length: 120 }, (_, index) => tool(index)),
  toolChoice: 'auto',
  usage: { inputTokens: 13707, outputTokens: 665 },
  finishReason: 'tool-calls',
};

const viewOf = (container: HTMLElement) => {
  const editor = container.querySelector<HTMLElement>('.cm-editor');
  const view = editor && EditorView.findFromDOM(editor);
  if (!view) throw new Error('No editor');
  return view;
};

const visibleText = (container: HTMLElement) => container.querySelector('.cm-content')?.textContent ?? '';

const foldedValues = (container: HTMLElement) => {
  const view = viewOf(container);
  const folded: string[] = [];
  foldedRanges(view.state).between(0, view.state.doc.length, from => {
    folded.push(view.state.doc.lineAt(from).text.trim());
  });
  return folded;
};

describe('SpanPayloadJson', () => {
  describe('with foldNested', () => {
    it('folds every multi-line top-level value, including those far past a large one', async () => {
      const { container } = render(<SpanPayloadJson value={attributes} foldNested />);

      await waitFor(() =>
        expect(foldedValues(container)).toEqual(['"parameters": {', '"availableTools": [', '"tools": [', '"usage": {']),
      );
    });

    it('leaves the payload open without it', async () => {
      const { container } = render(<SpanPayloadJson value={attributes} />);
      await waitFor(() => expect(container.querySelector('.cm-editor')).not.toBeNull());
      expect(foldedValues(container)).toEqual([]);
    });
  });

  describe('with foldRoot', () => {
    it('opens on a single folded root, and unfolding it shows the keys with their values still folded', async () => {
      const { container } = render(<SpanPayloadJson value={attributes} foldRoot foldNested />);

      await waitFor(() => expect(visibleText(container).trim()).toBe('{…}'));

      const view = viewOf(container);
      const root = { from: view.state.doc.line(1).to, to: view.state.doc.line(view.state.doc.lines).from };
      view.dispatch({ effects: unfoldEffect.of(root) });

      await waitFor(() => expect(visibleText(container)).toContain('"tools": […]'));
      expect(visibleText(container)).toContain('"finishReason": "tool-calls"');
      expect(visibleText(container)).not.toContain('tool_0');
    });

    it('folds again when the editor is given another payload, e.g. after selecting another span', async () => {
      const { container, rerender } = render(<SpanPayloadJson value={attributes} foldRoot foldNested />);
      await waitFor(() => expect(visibleText(container).trim()).toBe('{…}'));
      const editor = viewOf(container);

      rerender(<SpanPayloadJson value={{ ...attributes, model: 'gpt-5' }} foldRoot foldNested />);

      await waitFor(() => expect(viewOf(container).state.doc.toString()).toContain('"gpt-5"'));
      expect(viewOf(container)).toBe(editor);
      await waitFor(() => expect(visibleText(container).trim()).toBe('{…}'));
    });
  });
});

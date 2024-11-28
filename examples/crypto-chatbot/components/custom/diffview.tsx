import OrderedMap from 'orderedmap';
import {
  Schema,
  Node as ProsemirrorNode,
  MarkSpec,
  DOMParser,
} from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

import { diffEditor, DiffType } from '@/lib/editor/diff';

const diffSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  marks: OrderedMap.from({
    ...schema.spec.marks.toObject(),
    diffMark: {
      attrs: { type: { default: '' } },
      toDOM(mark) {
        let className = '';

        switch (mark.attrs.type) {
          case DiffType.Inserted:
            className =
              'bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300';
            break;
          case DiffType.Deleted:
            className =
              'bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300';
            break;
          default:
            className = '';
        }
        return ['span', { class: className }, 0];
      },
    } as MarkSpec,
  }),
});

function computeDiff(oldDoc: ProsemirrorNode, newDoc: ProsemirrorNode) {
  return diffEditor(diffSchema, oldDoc.toJSON(), newDoc.toJSON());
}

type DiffEditorProps = {
  oldContent: string;
  newContent: string;
};

export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const parser = DOMParser.fromSchema(diffSchema);

      const oldHtmlContent = renderToString(
        <ReactMarkdown>{oldContent}</ReactMarkdown>
      );
      const newHtmlContent = renderToString(
        <ReactMarkdown>{newContent}</ReactMarkdown>
      );

      const oldContainer = document.createElement('div');
      oldContainer.innerHTML = oldHtmlContent;

      const newContainer = document.createElement('div');
      newContainer.innerHTML = newHtmlContent;

      const oldDoc = parser.parse(oldContainer);
      const newDoc = parser.parse(newContainer);

      const diffedDoc = computeDiff(oldDoc, newDoc);

      const state = EditorState.create({
        doc: diffedDoc,
        plugins: [],
      });

      viewRef.current = new EditorView(editorRef.current, {
        state,
        editable: () => false,
      });
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [oldContent, newContent]);

  return <div className="diff-editor" ref={editorRef} />;
};

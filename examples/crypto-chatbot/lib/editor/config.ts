import { textblockTypeInputRule } from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { MutableRefObject } from 'react';

import { buildContentFromDocument } from './functions';

export const documentSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  marks: schema.spec.marks,
});

export function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    documentSchema.nodes.heading,
    () => ({ level })
  );
}

export const handleTransaction = ({
  transaction,
  editorRef,
  saveContent,
}: {
  transaction: Transaction;
  editorRef: MutableRefObject<EditorView | null>;
  saveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  if (!editorRef || !editorRef.current) return;

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  if (transaction.docChanged && !transaction.getMeta('no-save')) {
    const updatedContent = buildContentFromDocument(newState.doc);

    if (transaction.getMeta('no-debounce')) {
      saveContent(updatedContent, false);
    } else {
      saveContent(updatedContent, true);
    }
  }
};

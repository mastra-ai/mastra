import { Editor, Content as TipTapContent } from '@tiptap/core';
import { EditorContent, useEditor, EditorOptions } from '@tiptap/react';
import React from 'react';

import './editor-custom-styles.css';
import { allEditorExtensions } from './extensions/extensions';
import { TipTapEditorProps } from './props';

export type EditorContent = ReturnType<Editor['getJSON']>;

export type Content = (TipTapContent & string) | undefined;

/**
 * Wraps Tiptap's useEditor hook to provide more functionalities..
 */

export function useMastraEditor({
  onUpdate,
  extensions = allEditorExtensions,
  content,
  testId,
}: React.HTMLAttributes<HTMLDivElement> & {
  content?: Content;
  onUpdate?: EditorOptions['onUpdate'];
  extensions?: EditorOptions['extensions'];
  testId?: string;
}) {
  const editor = useEditor({
    content,
    extensions: extensions,
    editorProps: {
      ...TipTapEditorProps,
      attributes: {
        ...TipTapEditorProps.attributes,
        'data-testid': testId as string, // "data-testid": "compose-email-template-editor
      },
    },
    onUpdate: async props => {
      if (onUpdate) onUpdate(props);
    },
  });

  return {
    editor,
  };
}

/**
 * Tip EditorContent component with other boilerplate components
 */
export const WrappedEditorContent = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
  return (
    <div className="relative h-full">
      <div className={`relative h-full`}>
        <EditorContent editor={editor} className="selection:bg-accent-5 h-full" />
      </div>
    </div>
  );
};

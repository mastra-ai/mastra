import { Editor } from '@tiptap/react';

import { BubbleMenuItem } from './types';

export function useRichEmail(editor: Editor) {
  const items: BubbleMenuItem[] = [
    {
      name: 'Undo',
      command: () => editor?.chain().focus().undo().run(),
      icon: 'undo',
    },
    {
      name: 'Redo',
      command: () => editor?.chain().focus().redo().run(),
      icon: 'redo',
    },
    {
      name: 'Bold',
      isActive: () => (editor ? editor?.isActive('bold') : false),
      command: () => editor?.chain().focus().toggleBold().run(),
      icon: 'bold',
    },
    {
      name: 'Italic',
      isActive: () => (editor ? editor.isActive('italic') : false),
      command: () => editor?.chain().focus().toggleItalic().run(),
      icon: 'italic',
    },
    {
      name: 'Underline',
      isActive: () => (editor ? editor.isActive('underline') : false),
      command: () => editor?.chain().focus().toggleUnderline().run(),
      icon: 'underline',
    },
    {
      name: 'Strikethrough',
      isActive: () => (editor ? editor.isActive('strike') : false),
      command: () => editor?.chain().focus().toggleStrike().run(),
      icon: 'strikethrough',
    },
    {
      name: 'Bulleted list',
      isActive: () => (editor ? editor.isActive('bulletList') : false),
      command: () => editor?.chain().focus().toggleBulletList().run(),
      icon: 'list',
    },
    {
      name: 'Numbered list',
      isActive: () => (editor ? editor.isActive('orderedList') : false),
      command: () => editor?.chain().focus().toggleOrderedList().run(),
      icon: 'list-ordered',
    },
  ];

  const headingLevel: BubbleMenuItem[] = [
    {
      name: 'Large heading',
      isActive: () => (editor ? editor.isActive('heading', { level: 1 }) : false),
      command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      icon: 'heading-1',
    },
    {
      name: 'Medium heading',
      isActive: () => (editor ? editor.isActive('heading', { level: 2 }) : false),
      command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      icon: 'heading-2',
    },
    {
      name: 'Small heading',
      isActive: () => (editor ? editor.isActive('heading', { level: 3 }) : false),
      command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      icon: 'heading-3',
    },
  ];

  return { items, headingLevel };
}

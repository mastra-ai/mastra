import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

import { CustomKeymap } from './custom-keymap';

const StarterKitExtensions = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: 'list-disc list-outside leading-3 -mt-2',
    },
  },
  paragraph: {
    HTMLAttributes: {
      class: 'mt-0 mb-0',
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: 'list-decimal list-outside leading-3 -mt-2',
    },
  },
  listItem: {
    HTMLAttributes: {
      class: 'leading-normal -mb-2',
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: 'border-l-4 border-stone-700',
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: '#DBEAFE',
    width: 4,
  },
  gapcursor: false,
});

const LinkExtension = Link.configure({
  HTMLAttributes: {
    class: 'text-text underline underline-offset-[3px] hover:text-text-dim transition-colors cursor-pointer',
  },
});

const PlaceholderExtension = Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'heading') {
      return `Heading ${node.attrs.level}`;
    }
    return 'Press / for commands or start typing...';
  },
  includeChildren: true,
});

export const allEditorExtensions = [
  StarterKitExtensions,
  PlaceholderExtension,
  LinkExtension,
  TextStyle,
  Color,
  Highlight.configure({
    multicolor: true,
  }),
  Underline,
  CustomKeymap,
  Markdown.configure({
    html: false,
    transformCopiedText: true,
    transformPastedText: true,
  }),
];

export const simpleEditorExtensions = [StarterKitExtensions, Underline];

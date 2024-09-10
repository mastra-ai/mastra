import { InputRule } from '@tiptap/core';
// import { mergeAttributes } from '@tiptap/core';
import Color from '@tiptap/extension-color';
// import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
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
  codeBlock: {
    HTMLAttributes: {
      class: 'rounded-sm bg-[#66686A]/20 p-5 font-mono font-medium text-text',
    },
  },
  code: {
    HTMLAttributes: {
      class: 'rounded-md bg-[#66686A]/20 px-1.5 py-1 font-mono font-medium text-text',
      spellcheck: 'true',
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: '#DBEAFE',
    width: 4,
  },
  gapcursor: false,
});

const HorizontalRuleExtension = HorizontalRule.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /^(?:---|—-|___\s|\*\*\*\s)$/,
        handler: ({ state, range }) => {
          const attributes = {};

          const { tr } = state;
          const start = range.from;
          let end = range.to;

          tr.insert(start - 1, this.type.create(attributes)).delete(tr.mapping.map(start), tr.mapping.map(end));
        },
      }),
    ];
  },
}).configure({
  HTMLAttributes: {
    class: 'novel-mt-4 novel-mb-6 novel-border-t novel-border-stone-300',
  },
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

const TaskListExtension = TaskList.configure({
  HTMLAttributes: {
    class: 'not-prose -pl-2 flex flex-col gap-2',
  },
});

const TaskItemExtension = TaskItem.configure({
  HTMLAttributes: {
    class: 'flex items-center gap-1 px-2',
  },
  nested: true,
});

export const allEditorExtensions = [
  StarterKitExtensions,
  HorizontalRuleExtension,
  PlaceholderExtension,
  TaskListExtension,
  TaskItemExtension,
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
  // Heading.extend({
  //   levels: [1, 2, 3],
  //   renderHTML({ node, HTMLAttributes }) {
  //     const level = this.options.levels.includes(node.attrs.level) ? node.attrs.level : this.options.levels[0];
  //     console.log({ level });
  //     const classes: { [index: number]: string } = {
  //       1: 'text-4xl',
  //       2: 'text-3xl',
  //       3: 'text-2xl',
  //     };
  //     return [
  //       `h${level}`,
  //       mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
  //         class: `${classes[level]}`,
  //       }),
  //       0,
  //     ];
  //   },
  // }).configure({ levels: [1, 2, 3] }),
];

export const simpleEditorExtensions = [StarterKitExtensions, Underline];

import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { markdownLanguage } from '@codemirror/lang-markdown';
import type { EditorView } from '@codemirror/view';
import { insideCodeBlock } from './markdown-commands';

type Block = { label: string; markdown: string; insert: string; caret?: number };

const blocks: readonly Block[] = [
  { label: 'Heading 1', markdown: '#', insert: '# ' },
  { label: 'Heading 2', markdown: '##', insert: '## ' },
  { label: 'Heading 3', markdown: '###', insert: '### ' },
  { label: 'Bulleted list', markdown: '-', insert: '- ' },
  { label: 'Numbered list', markdown: '1.', insert: '1. ' },
  { label: 'Quote', markdown: '>', insert: '> ' },
  { label: 'Code block', markdown: '```', insert: '```\n\n```', caret: 4 },
  { label: 'Divider', markdown: '***', insert: '***\n' },
];

const options: Completion[] = blocks.map((block, index) => ({
  label: block.label,
  detail: block.markdown,
  type: 'keyword',
  boost: -index,
  apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
    const slash = from - 1;
    view.dispatch({
      changes: { from: slash, to, insert: block.insert },
      selection: { anchor: slash + (block.caret ?? block.insert.length) },
      scrollIntoView: true,
      userEvent: 'input.complete',
    });
  },
}));

function slashCompletions(context: CompletionContext): CompletionResult | null {
  if (context.state.readOnly) return null;
  const typed = context.matchBefore(/\/\w*$/);
  if (!typed) return null;
  const line = context.state.doc.lineAt(typed.from);
  if (context.state.sliceDoc(line.from, typed.from).trim() !== '' || insideCodeBlock(context.state, typed.from)) {
    return null;
  }
  return { from: typed.from + 1, options, validFor: /^\w*$/ };
}

export const slashCommands = markdownLanguage.data.of({ autocomplete: slashCompletions });

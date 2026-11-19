import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState, Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import type { BasicSetupOptions, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { forwardRef, useMemo, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { livePreview } from './extensions/live-preview';
import { formattingKeymap } from './extensions/markdown-commands';
import { proseStyle } from './extensions/prose-style';
import { createSelectionToolbar } from './extensions/selection-toolbar';
import { slashCommands } from './extensions/slash-commands';
import { FormattingToolbar } from './formatting-toolbar';
import { codeLanguages } from '@/ds/components/CodeEditor/code-languages';
import {
  codemirrorChrome,
  editorFocusExtensions,
  inlineFieldTheme,
  useCodemirrorFieldAttributes,
} from '@/ds/components/CodeEditor/codemirror-field';
import { fieldErrorRimWithin, inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

const markdownEditorVariants = cva('relative transition-colors duration-normal ease-out-custom', {
  variants: {
    variant: {
      default: cn(inputSurfaceAndFocusWithinStyle, 'rounded-md px-3 py-2', fieldErrorRimWithin),
      inline: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const basicSetup: BasicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  highlightSelectionMatches: false,
  bracketMatching: false,
  closeBrackets: false,
};

const markdownExtensions: Extension[] = [
  ...editorFocusExtensions,
  inlineFieldTheme,
  EditorView.lineWrapping,
  markdown({ base: markdownLanguage, codeLanguages }),
  proseStyle,
  livePreview,
  formattingKeymap,
  slashCommands,
];

const readOnly: Extension = [
  EditorState.readOnly.of(true),
  Prec.highest(EditorView.domEventHandlers({ paste: () => true })),
];

export type MarkdownEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
} & VariantProps<typeof markdownEditorVariants> &
  Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const MarkdownEditor = forwardRef<ReactCodeMirrorRef, MarkdownEditorProps>(function MarkdownEditor(
  {
    value,
    onChange,
    placeholder,
    editable = true,
    autoFocus,
    variant,
    className,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const { contentAttributes } = useCodemirrorFieldAttributes(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    'Markdown editor',
  );
  const [toolbar] = useState(createSelectionToolbar);
  const extensions = useMemo(
    () => [...markdownExtensions, contentAttributes, toolbar.extension, ...(editable ? [] : [readOnly])],
    [contentAttributes, toolbar, editable],
  );

  return (
    <div className={cn(markdownEditorVariants({ variant }), className)} {...props}>
      <CodeMirror
        ref={ref}
        value={value}
        theme={codemirrorChrome('body')}
        extensions={extensions}
        onChange={onChange}
        editable={editable}
        placeholder={placeholder}
        autoFocus={autoFocus}
        basicSetup={basicSetup}
      />
      <FormattingToolbar toolbar={toolbar} />
    </div>
  );
});

import { jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorState, Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { Braces } from 'lucide-react';
import { forwardRef, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { codeLanguages } from './code-languages';
import { codeFoldGutter } from './fold-gutter-extension';
import { syntaxHighlighter } from './highlight';
import { createVariableAutocomplete } from './variable-autocomplete-extension';
import { variableHighlight } from './variable-highlight-extension';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { useFieldControlAria } from '@/ds/components/Field/field-control-aria';
import { fieldErrorRimWithin, inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import { formatJSON } from '@/lib/formatting';
import type { JsonSchema } from '@/lib/json-schema';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export type CodeEditorLanguage = 'json' | 'markdown';
type CodeEditorFont = 'body' | 'mono';

/**
 * The single CodeMirror theme for every editor. Chrome and syntax colors come
 * from CSS variables that flip under `.dark`, and syntax roles use the same
 * `syntaxHighlighter` as the read-only `<Code>` viewer, so editors and viewers
 * look identical in both modes.
 */
function buildCodemirrorTheme(font: CodeEditorFont): Extension {
  const editorTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      fontSize: 'var(--text-body-sm)',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: `var(--font-${font})`,
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--placeholder)',
      borderRight: 'none',
    },
    '.cm-content': {
      color: 'var(--foreground)',
      caretColor: 'var(--foreground)',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--placeholder)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--foreground)',
    },
    '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
      {
        background: 'var(--info-edge) !important',
      },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      boxShadow: 'var(--elevation-overlay)',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-completionLabel': {
      color: 'var(--foreground)',
    },
    '.cm-completionDetail': {
      color: 'var(--muted-foreground)',
      fontSize: 'var(--text-caption)',
      marginLeft: 'auto',
      paddingLeft: '12px',
    },
    '.cm-completionInfo': {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      color: 'var(--muted-foreground)',
      padding: '8px 12px',
    },
    '.cm-completionIcon': {
      display: 'none',
    },
    'ul.cm-completionList li[aria-selected]': {
      backgroundColor: 'var(--fill-hover)',
      color: 'var(--foreground)',
    },
    '.cm-line .cm-variable-highlight': {
      color: 'var(--warning-foreground) !important',
      fontWeight: '500',
    },
  });

  return [editorTheme, syntaxHighlighting(syntaxHighlighter)];
}

// eslint-disable-next-line react-refresh/only-export-components -- shared hook intentionally co-located with the editor it themes
export const useCodemirrorTheme = (font: CodeEditorFont = 'mono'): Extension => {
  return useMemo(() => buildCodemirrorTheme(font), [font]);
};

const codeEditorVariants = cva(
  cn(
    'relative overflow-hidden font-mono outline-hidden focus-within:outline-hidden focus:outline-hidden',
    'transition-colors duration-normal ease-out-custom',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusWithinStyle, 'rounded-md p-1', fieldErrorRimWithin),
        embedded: 'rounded-none border-none bg-transparent p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const editorFocusAttributes = Prec.highest(
  EditorView.editorAttributes.of({
    style: 'outline: none',
  }),
);

const editorFocusTheme = Prec.highest(
  EditorView.theme({
    '&': {
      outline: 'none',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      outline: 'none',
    },
    '.cm-content': {
      outline: 'none',
    },
    '.cm-content:focus': {
      outline: 'none',
    },
  }),
);

const editorFocusExtensions: Extension[] = [editorFocusAttributes, editorFocusTheme];

type CodeEditorContentAttributes = {
  'aria-label': string;
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: string;
};

export type CodeEditorProps = {
  /** Prose editors can opt into the body face; code stays monospace by default. */
  font?: CodeEditorFont;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  value?: string;
  onChange?: (value: string) => void;
  showCopyButton?: boolean;
  /** Offers a button that rewrites the JSON with Prettier. Needs `onChange`; ignored for markdown or read-only editors. */
  showFormatButton?: boolean;
  className?: string;
  highlightVariables?: boolean;
  language?: CodeEditorLanguage;
  placeholder?: string;
  /** JSON Schema to enable variable autocomplete for {{variable}} placeholders (markdown only) */
  schema?: JsonSchema;
  autoFocus?: boolean;
  /** Show line numbers in the gutter (default: true) */
  lineNumbers?: boolean;
  /** Wrap long lines within the editor viewport (default: true) */
  lineWrapping?: boolean;
  /** When false, makes the editor read-only */
  editable?: boolean;
  /** Extra CodeMirror extensions, added after the built-in ones. Memoize them to avoid reconfiguring on every render. */
  extensions?: Extension[];
} & VariantProps<typeof codeEditorVariants> &
  Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>;

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(
  (
    {
      data,
      value,
      onChange,
      showCopyButton = true,
      showFormatButton = false,
      className,
      language = 'json',
      font = 'mono',
      highlightVariables = false,
      placeholder,
      schema,
      autoFocus,
      lineNumbers = true,
      lineWrapping = true,
      editable,
      extensions: extraExtensions,
      variant,
      id,
      'aria-label': ariaLabelProp,
      'aria-labelledby': ariaLabelledByProp,
      'aria-describedby': ariaDescribedByProp,
      'aria-invalid': ariaInvalidProp,
      ...props
    },
    ref,
  ) => {
    const fieldAria = useFieldControlAria({ 'aria-label': ariaLabelProp });
    const ariaLabel = ariaLabelProp ?? 'Code editor';
    const controlId = id ?? fieldAria.id;
    const ariaLabelledBy = ariaLabelledByProp ?? fieldAria['aria-labelledby'];
    const ariaDescribedBy = ariaDescribedByProp ?? fieldAria['aria-describedby'];
    const ariaInvalid = ariaInvalidProp ?? fieldAria['aria-invalid'];
    const theme = useCodemirrorTheme(font);
    const formattedCode = data ? JSON.stringify(data, null, 2) : (value ?? '');
    const canFormat = showFormatButton && language === 'json' && editable !== false && Boolean(onChange);

    const handleFormat = async () => {
      try {
        onChange?.((await formatJSON(formattedCode)).trimEnd());
      } catch {
        toast.error('Can’t format: the JSON is invalid');
      }
    };

    const extensions = useMemo(() => {
      const contentAttributes: CodeEditorContentAttributes = { 'aria-label': ariaLabel };
      if (controlId) contentAttributes.id = controlId;
      if (ariaLabelledBy) contentAttributes['aria-labelledby'] = ariaLabelledBy;
      if (ariaDescribedBy) contentAttributes['aria-describedby'] = ariaDescribedBy;
      if (ariaInvalid !== undefined) contentAttributes['aria-invalid'] = String(ariaInvalid);

      const exts: Extension[] = [
        ...editorFocusExtensions,
        EditorView.contentAttributes.of(contentAttributes),
        codeFoldGutter,
      ];

      if (lineWrapping) {
        exts.push(EditorView.lineWrapping);
      }

      if (language === 'json') {
        exts.push(jsonLanguage);
      } else if (language === 'markdown') {
        exts.push(markdown({ base: markdownLanguage, codeLanguages }));
      }

      if (highlightVariables && language === 'markdown') {
        exts.push(variableHighlight);
      }

      if (schema && language === 'markdown') {
        exts.push(createVariableAutocomplete(schema));
      }

      if (editable === false) {
        exts.push(EditorState.readOnly.of(true));
      }

      if (extraExtensions) {
        exts.push(...extraExtensions);
      }

      return exts;
    }, [
      extraExtensions,
      language,
      highlightVariables,
      schema,
      editable,
      lineWrapping,
      controlId,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaInvalid,
    ]);

    return (
      <div className={cn(codeEditorVariants({ variant }), className)} {...props}>
        {(showCopyButton || canFormat) && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            {canFormat && (
              <Button type="button" size="sm" tooltip="Format JSON" aria-label="Format JSON" onClick={handleFormat}>
                <Braces />
              </Button>
            )}
            {showCopyButton && <CopyButton content={formattedCode} />}
          </div>
        )}
        <CodeMirror
          ref={ref}
          value={formattedCode}
          theme={theme}
          extensions={extensions}
          onChange={onChange}
          editable={editable}
          aria-label={ariaLabel}
          placeholder={placeholder}
          height="100%"
          style={{ height: '100%' }}
          autoFocus={autoFocus}
          basicSetup={{ lineNumbers, foldGutter: false }}
        />
      </div>
    );
  },
);

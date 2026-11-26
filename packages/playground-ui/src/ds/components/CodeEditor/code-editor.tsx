import { jsonLanguage } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import type { Language } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { forwardRef, use, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { codeLanguages } from './code-languages';
import {
  codemirrorChrome,
  editorFocusExtensions,
  inlineFieldTheme,
  useCodemirrorFieldAttributes,
} from './codemirror-field';
import type { CodemirrorFont } from './codemirror-field';
import { codeFoldGutter } from './fold-gutter-extension';
import { loadLanguage, syntaxHighlighter } from './highlight';
import type { HighlightLanguage } from './highlight';
import { createVariableAutocomplete } from './variable-autocomplete-extension';
import { variableHighlight } from './variable-highlight-extension';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { fieldErrorRimWithin, inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import { formatJSON } from '@/lib/formatting';
import type { JsonSchema } from '@/lib/json-schema';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export type CodeEditorLanguage = HighlightLanguage | 'text';

const editorLanguages = new Map<HighlightLanguage, Promise<Language | undefined>>();

function loadEditorLanguage(language: HighlightLanguage) {
  let loaded = editorLanguages.get(language);
  if (!loaded) {
    loaded = loadLanguage(language).catch(() => undefined);
    editorLanguages.set(language, loaded);
  }
  return loaded;
}

// eslint-disable-next-line react-refresh/only-export-components -- shared hook intentionally co-located with the editor it themes
export const useCodemirrorTheme = (font: CodemirrorFont = 'mono'): Extension => {
  return useMemo(() => [codemirrorChrome(font), syntaxHighlighting(syntaxHighlighter)], [font]);
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
        inline: 'rounded-none border-none bg-transparent p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type CodeEditorProps = {
  font?: CodemirrorFont;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  value?: string;
  onChange?: (value: string) => void;
  showCopyButton?: boolean;
  showFormatButton?: boolean;
  className?: string;
  highlightVariables?: boolean;
  language?: CodeEditorLanguage;
  placeholder?: string;
  schema?: JsonSchema;
  autoFocus?: boolean;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  editable?: boolean;
  /** Memoize: a new array reconfigures the editor on every render. */
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
    const { ariaLabel, contentAttributes } = useCodemirrorFieldAttributes(
      {
        id,
        'aria-label': ariaLabelProp,
        'aria-labelledby': ariaLabelledByProp,
        'aria-describedby': ariaDescribedByProp,
        'aria-invalid': ariaInvalidProp,
      },
      'Code editor',
    );
    const theme = useCodemirrorTheme(font);
    const loadedLanguage =
      language === 'json' || language === 'markdown' || language === 'text'
        ? undefined
        : use(loadEditorLanguage(language));
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
      const exts: Extension[] = [
        ...editorFocusExtensions,
        contentAttributes,
        variant === 'inline' ? inlineFieldTheme : codeFoldGutter,
      ];

      if (lineWrapping) {
        exts.push(EditorView.lineWrapping);
      }

      if (language === 'json') {
        exts.push(jsonLanguage);
      } else if (language === 'markdown') {
        exts.push(markdown({ base: markdownLanguage, codeLanguages }));
      } else if (loadedLanguage) {
        exts.push(loadedLanguage);
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
      variant,
      language,
      loadedLanguage,
      highlightVariables,
      schema,
      editable,
      lineWrapping,
      contentAttributes,
    ]);

    return (
      <div className={cn(codeEditorVariants({ variant }), className)} {...props}>
        {(showCopyButton || canFormat) && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            {canFormat && (
              <Button
                type="button"
                size="icon-sm"
                tooltip="Format JSON"
                aria-label="Format JSON"
                onClick={handleFormat}
              >
                <IconCodeBrackets />
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

import * as React from 'react';
import type { ThemedToken } from 'shiki';

import { highlight } from '../CodeEditor';
import { CopyButton } from '../CopyButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { Tab, TabList, Tabs } from '../Tabs';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type CodeBlockSelector = 'select' | 'tabs';

export interface CodeBlockOption {
  label: string;
  value: string;
}

export interface CodeBlockProps {
  code: string;
  options?: CodeBlockOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  selector?: CodeBlockSelector;
  fileName?: string;
  lang?: string;
  copyMessage?: string;
  copyTooltip?: string;
  className?: string;
}

export function CodeBlock({
  code,
  options,
  value,
  onValueChange,
  selector = 'select',
  fileName,
  lang,
  copyMessage,
  copyTooltip,
  className,
}: CodeBlockProps) {
  const hasOptions = options && options.length > 0;
  const useTabs = hasOptions && selector === 'tabs';
  const useSelect = hasOptions && selector === 'select';
  const activeValue = value ?? options?.[0]?.value;

  return (
    <figure
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border2/40 bg-surface2',
        className,
      )}
    >
      {useTabs && options && (
        <Tabs defaultTab={options[0].value} value={activeValue} onValueChange={onValueChange ?? (() => {})}>
          <TabList>
            {options.map(opt => (
              <Tab key={opt.value} value={opt.value}>
                {opt.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      )}

      {useSelect && options && (
        <div className="flex items-center border-b border-border2/40 px-2 py-1.5">
          <Select value={activeValue} onValueChange={onValueChange}>
            <SelectTrigger size="sm" variant="ghost">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasOptions && fileName && (
        <div className="flex items-center border-b border-border2/40 px-4 py-2">
          <figcaption className="font-mono text-ui-sm text-neutral4">{fileName}</figcaption>
        </div>
      )}

      <div className="relative">
        <HighlightedCode code={code} lang={lang} />
        <CopyButton
          content={code}
          copyMessage={copyMessage}
          tooltip={copyTooltip}
          size="sm"
          className={cn(
            'absolute top-2 right-2 opacity-100 pointer-fine:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            transitions.opacity,
          )}
        />
      </div>
    </figure>
  );
}

interface HighlightedCodeProps {
  code: string;
  lang?: string;
}

function HighlightedCode({ code, lang }: HighlightedCodeProps) {
  const [tokens, setTokens] = React.useState<ThemedToken[][] | null>(null);

  React.useEffect(() => {
    if (!lang) {
      setTokens(null);
      return;
    }
    setTokens(null);
    let cancelled = false;
    void highlight(code, lang)
      .then(result => {
        if (!cancelled && result) setTokens(result);
      })
      .catch(() => {
        // Highlighting failed — plain-text fallback remains visible.
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const preClass = 'px-4 py-3 font-mono text-ui-sm text-neutral5 whitespace-pre-wrap break-all';

  if (!lang || !tokens) {
    return <pre className={preClass}>{code}</pre>;
  }

  return (
    <pre className={preClass}>
      <code>
        {tokens.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            <span>
              {line.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  className="text-shiki-light bg-shiki-light-bg dark:text-shiki-dark dark:bg-shiki-dark-bg"
                >
                  {token.content}
                </span>
              ))}
            </span>
            {lineIndex !== tokens.length - 1 && '\n'}
          </React.Fragment>
        ))}
      </code>
    </pre>
  );
}

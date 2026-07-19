import type { ReactNode } from 'react';
import { Code } from '../Code/code';
import { CopyButton } from '../CopyButton/copy-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select/select';
import { TabList } from '../Tabs/tabs-list';
import { Tabs } from '../Tabs/tabs-root';
import { Tab } from '../Tabs/tabs-tab';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type CodeBlockSelector = 'select' | 'tabs';

export type CodeBlockOverflow = 'wrap' | 'scroll';

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
  /** `wrap` (default) breaks long lines — best for commands and snippets.
   *  `scroll` preserves columns behind a horizontal scroll — best for source code. */
  overflow?: CodeBlockOverflow;
  copyMessage?: string;
  copyTooltip?: string;
  actions?: ReactNode;
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
  overflow = 'wrap',
  copyMessage,
  copyTooltip,
  actions,
  className,
}: CodeBlockProps) {
  const hasOptions = options && options.length > 0;
  const useTabs = hasOptions && selector === 'tabs';
  const useSelect = hasOptions && selector === 'select';
  const firstOption = options?.[0];
  const activeValue = value ?? firstOption?.value;

  return (
    <figure
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border2/40 bg-surface2',
        className,
      )}
    >
      {useTabs && firstOption && (
        <Tabs defaultTab={firstOption.value} value={activeValue} onValueChange={onValueChange ?? (() => {})}>
          <div className="flex items-stretch">
            <div className="min-w-0 flex-1">
              <TabList>
                {options.map(opt => (
                  <Tab key={opt.value} value={opt.value}>
                    {opt.label}
                  </Tab>
                ))}
              </TabList>
            </div>
            {actions && <div className="flex shrink-0 items-center border-b border-border1 pr-2 pl-3">{actions}</div>}
          </div>
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
          {actions && <div className="ml-auto flex items-center">{actions}</div>}
        </div>
      )}

      {!hasOptions && fileName && (
        <div className="flex items-center border-b border-border2/40 px-4 py-2">
          <figcaption className="font-mono text-ui-sm text-neutral4">{fileName}</figcaption>
          {actions && <div className="ml-auto flex items-center">{actions}</div>}
        </div>
      )}

      {!hasOptions && !fileName && actions && (
        <div className="flex items-center justify-end border-b border-border2/40 px-2 py-1.5">{actions}</div>
      )}

      <div className="relative">
        <Code
          code={code}
          lang={lang}
          className={cn(
            'px-4 py-3 font-mono text-ui-sm text-neutral5',
            overflow === 'scroll' ? 'overflow-x-auto whitespace-pre' : 'break-all whitespace-pre-wrap',
          )}
        />
        <CopyButton
          content={code}
          copyMessage={copyMessage}
          tooltip={copyTooltip}
          size="sm"
          className={cn(
            'absolute top-2 right-2 opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 pointer-fine:opacity-0',
            transitions.opacity,
          )}
        />
      </div>
    </figure>
  );
}

import { ChevronRight, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Card } from '../Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../Collapsible';
import { Txt } from '../Txt';

export interface ToolCardShellProps {
  children: ReactNode;
  testId?: string;
  className?: string;
}

/**
 * Card chrome shared by every tool card. Pure design-system wrapper so both the
 * generic fallback and the bespoke client-tool cards compose the same shell.
 */
export const ToolCardShell = ({ children, testId, className }: ToolCardShellProps) => (
  <Card
    data-testid={testId}
    className={cn(
      'max-w-[80%] p-3 bg-surface2/60 border-border1/60 animate-in fade-in slide-in-from-left-2 duration-300',
      className,
    )}
  >
    {children}
  </Card>
);

const safeStringify = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export interface GenericToolCardProps {
  toolName: string;
  input?: unknown;
  output?: unknown;
}

/**
 * Default tool fallback: collapsible Input/Output JSON inside the shared shell.
 */
export const GenericToolCard = ({ toolName, input, output }: GenericToolCardProps) => {
  const inputJson = safeStringify(input);
  const outputJson = safeStringify(output);
  const hasOutput = outputJson.length > 0;

  return (
    <ToolCardShell testId="generic-tool-card">
      <Collapsible>
        <CollapsibleTrigger
          className="flex w-full items-center gap-2 text-left group"
          data-testid="generic-tool-card-trigger"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border1/60 bg-surface1 px-2 py-0.5">
            <Wrench className="size-3.5 shrink-0 text-neutral4" aria-hidden />
            <Txt variant="ui-sm" className="text-neutral5" as="span">
              Executing <span className="font-mono text-neutral6">{toolName}</span>
            </Txt>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-neutral4 transition-transform group-data-[state=open]:rotate-90"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 flex flex-col gap-2" data-testid="generic-tool-card-content">
            <div className="rounded-md border border-border1/60 bg-surface1 overflow-hidden">
              <div className="px-2 py-1 border-b border-border1/60">
                <Txt variant="ui-sm" className="text-neutral3" as="div">
                  Input
                </Txt>
              </div>
              <pre className="m-0 max-h-[320px] overflow-auto p-3 text-xs leading-relaxed text-neutral5 whitespace-pre-wrap break-words">
                {inputJson || '{}'}
              </pre>
            </div>
            {hasOutput ? (
              <div className="rounded-md border border-border1/60 bg-surface1 overflow-hidden">
                <div className="px-2 py-1 border-b border-border1/60">
                  <Txt variant="ui-sm" className="text-neutral3" as="div">
                    Output
                  </Txt>
                </div>
                <pre className="m-0 max-h-[320px] overflow-auto p-3 text-xs leading-relaxed text-neutral5 whitespace-pre-wrap break-words">
                  {outputJson}
                </pre>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ToolCardShell>
  );
};

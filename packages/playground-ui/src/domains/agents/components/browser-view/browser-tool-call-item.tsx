import { useState } from 'react';
import { ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeEditor } from '@/ds/components/CodeEditor';
import type { BrowserToolCallEntry } from '../../context/browser-tool-calls-context';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  browser_navigate: 'Navigate',
  browser_click: 'Click',
  browser_type: 'Type',
  browser_scroll: 'Scroll',
  browser_screenshot: 'Screenshot',
  browser_snapshot: 'Snapshot',
  browser_close: 'Close',
  browser_select: 'Select',
};

const KEY_ARG_MAP: Record<string, string> = {
  browser_navigate: 'url',
  browser_click: 'ref',
  browser_type: 'text',
  browser_scroll: 'direction',
  browser_close: 'reason',
  browser_select: 'value',
};

function getDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] ?? toolName.replace('browser_', '');
}

function getKeyArgSummary(toolName: string, args: Record<string, unknown>): string | null {
  const key = KEY_ARG_MAP[toolName];
  if (!key) return null;
  const value = args[key];
  if (value === undefined || value === null) return null;
  const str = String(value);
  return str.length > 50 ? `${str.slice(0, 47)}...` : str;
}

interface BrowserToolCallItemProps {
  entry: BrowserToolCallEntry;
}

export function BrowserToolCallItem({ entry }: BrowserToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayName = getDisplayName(entry.toolName);
  const keyArg = getKeyArgSummary(entry.toolName, entry.args);

  const { __mastraMetadata: _, ...displayArgs } = entry.args as Record<string, unknown> & {
    __mastraMetadata?: unknown;
  };

  return (
    <div className="border-b border-border1 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-surface3 transition-colors"
      >
        <ChevronRight className={cn('h-3 w-3 text-neutral3 transition-transform shrink-0', isExpanded && 'rotate-90')} />

        <StatusDot status={entry.status} />

        <span className="text-xs font-medium text-neutral6 shrink-0">{displayName}</span>

        {keyArg && <span className="text-xs text-neutral3 truncate">{keyArg}</span>}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-2">
          <div>
            <p className="text-xs font-medium text-neutral4 pb-1">Arguments</p>
            <CodeEditor data={displayArgs} data-testid="browser-tool-args" />
          </div>

          {entry.result !== undefined && entry.result !== null && (
            <div>
              <p className="text-xs font-medium text-neutral4 pb-1">Result</p>
              {typeof entry.result === 'string' ? (
                <pre className="whitespace-pre text-xs bg-surface4 p-2 rounded-md overflow-x-auto max-h-40 overflow-y-auto">
                  {entry.result}
                </pre>
              ) : (
                <CodeEditor
                  data={entry.result as Record<string, unknown> | Record<string, unknown>[]}
                  data-testid="browser-tool-result"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: BrowserToolCallEntry['status'] }) {
  switch (status) {
    case 'pending':
      return <Loader2 className="h-3 w-3 text-neutral4 animate-spin shrink-0" />;
    case 'complete':
      return <Check className="h-3 w-3 text-green-500 shrink-0" />;
    case 'error':
      return <X className="h-3 w-3 text-red-500 shrink-0" />;
  }
}

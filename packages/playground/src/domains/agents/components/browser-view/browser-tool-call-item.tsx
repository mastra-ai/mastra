import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { BrowserToolCallEntry } from '../../context/browser-tool-calls-context';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // AgentBrowser tools
  browser_goto: 'Go to',
  browser_click: 'Click',
  browser_type: 'Type',
  browser_scroll: 'Scroll',
  browser_snapshot: 'Snapshot',
  browser_close: 'Close',
  browser_select: 'Select',
  browser_press: 'Press',
  browser_hover: 'Hover',
  browser_back: 'Back',
  browser_dialog: 'Dialog',
  browser_wait: 'Wait',
  browser_tabs: 'Tabs',
  browser_drag: 'Drag',
  browser_evaluate: 'Evaluate',
  // StagehandBrowser tools
  stagehand_navigate: 'Navigate',
  stagehand_act: 'Act',
  stagehand_extract: 'Extract',
  stagehand_observe: 'Observe',
  stagehand_close: 'Close',
  stagehand_tabs: 'Tabs',
};

const KEY_ARG_MAP: Record<string, string> = {
  // AgentBrowser tools
  browser_goto: 'url',
  browser_click: 'ref',
  browser_type: 'text',
  browser_scroll: 'direction',
  browser_close: 'reason',
  browser_select: 'value',
  browser_press: 'key',
  browser_hover: 'ref',
  browser_dialog: 'action',
  browser_wait: 'time',
  browser_tabs: 'action',
  browser_drag: 'sourceRef',
  browser_evaluate: 'expression',
  // StagehandBrowser tools
  stagehand_navigate: 'url',
  stagehand_act: 'action',
  stagehand_extract: 'instruction',
  stagehand_observe: 'instruction',
  stagehand_tabs: 'action',
};

function getDisplayName(toolName: string): string {
  if (TOOL_DISPLAY_NAMES[toolName]) {
    return TOOL_DISPLAY_NAMES[toolName];
  }
  // Strip known prefixes for fallback
  return toolName.replace(/^(browser_|stagehand_)/, '');
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
    <div className="border-border1 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="hover:bg-surface3 flex w-full items-center gap-2 px-3 py-0.5 text-left transition-colors"
      >
        <ChevronRight
          className={cn('h-3 w-3 text-neutral3 transition-transform shrink-0', isExpanded && 'rotate-90')}
        />

        <StatusDot status={entry.status} />

        <span className="text-neutral6 shrink-0 text-xs font-medium">{displayName}</span>

        {keyArg && <span className="text-neutral3 truncate text-xs">{keyArg}</span>}
      </button>

      {isExpanded && (
        <div className="space-y-2 px-3 pb-2">
          <div>
            <p className="text-neutral4 pb-1 text-xs font-medium">Arguments</p>
            <CodeEditor data={displayArgs} data-testid="browser-tool-args" />
          </div>

          {entry.result !== undefined && entry.result !== null && (
            <div>
              <p className="text-neutral4 pb-1 text-xs font-medium">Result</p>
              {typeof entry.result === 'string' ? (
                <pre className="bg-surface4 max-h-40 overflow-x-auto overflow-y-auto rounded-md p-2 text-xs whitespace-pre">
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
      return <Loader2 className="text-neutral4 h-3 w-3 shrink-0 animate-spin" />;
    case 'complete':
      return <Check className="h-3 w-3 shrink-0 text-green-500" />;
    case 'error':
      return <X className="h-3 w-3 shrink-0 text-red-500" />;
  }
}

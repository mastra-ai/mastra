import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { useBrowserToolCalls } from '../../context/browser-tool-calls-context';
import { BrowserToolCallItem } from './browser-tool-call-item';

interface BrowserToolCallHistoryProps {
  className?: string;
}

/**
 * Collapsible section showing browser tool call history.
 * Renders below the browser frame in BrowserViewPanel.
 */
export function BrowserToolCallHistory({ className }: BrowserToolCallHistoryProps) {
  const { toolCalls } = useBrowserToolCalls();
  const [isExpanded, setIsExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry when new tool calls arrive
  useEffect(() => {
    if (isExpanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [toolCalls.length, isExpanded]);

  if (toolCalls.length === 0) return null;

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="hover:bg-surface3 flex w-full shrink-0 items-center gap-2 px-3 py-1 text-left transition-colors"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 text-neutral3 transition-transform', isExpanded ? 'rotate-180' : '')} />
        <span className="text-neutral4 text-xs font-medium">Browser Actions ({toolCalls.length})</span>
      </button>

      {isExpanded && (
        <div ref={listRef} className="bg-surface1 flex-1 overflow-y-auto">
          {toolCalls.map(entry => (
            <BrowserToolCallItem key={entry.toolCallId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

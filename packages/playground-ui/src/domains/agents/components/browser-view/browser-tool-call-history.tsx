import { useRef, useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div className={cn('border-t border-border1 flex flex-col overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-3 py-1 text-left hover:bg-surface3 transition-colors shrink-0"
      >
        <ChevronUp
          className={cn('h-3.5 w-3.5 text-neutral3 transition-transform', isExpanded ? 'rotate-180' : 'rotate-90')}
        />
        <span className="text-xs font-medium text-neutral4">
          Browser Actions ({toolCalls.length})
        </span>
      </button>

      {isExpanded && (
        <div ref={listRef} className="flex-1 overflow-y-auto bg-surface1">
          {toolCalls.map(entry => (
            <BrowserToolCallItem key={entry.toolCallId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

import { ScrollArea } from '@mastra/playground-ui';
import type { KeyboardEvent } from 'react';

interface CodeDisplayProps {
  content: string;
  height?: string;
  isCopied?: boolean;
  isDraft?: boolean;
  onCopy?: () => void;
  className?: string;
}

export function CodeDisplay({
  content,
  height = '150px',
  isCopied = false,
  isDraft = false,
  onCopy,
  className = '',
}: CodeDisplayProps) {
  const handleCopyKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onCopy || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onCopy();
  };

  return (
    <div className={`rounded-md border ${className}`} style={{ height }}>
      <ScrollArea className="h-full">
        <div
          className="p-2 cursor-pointer hover:bg-surface4/50 transition-colors group relative"
          onClick={onCopy}
          onKeyDown={handleCopyKeyDown}
          role={onCopy ? 'button' : undefined}
          tabIndex={onCopy ? 0 : undefined}
          aria-label={onCopy ? 'Copy code' : undefined}
        >
          <pre className="text-ui-xs whitespace-pre-wrap font-mono">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <span className="text-ui-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {isCopied && (
            <span className="absolute top-2 right-2 text-ui-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
              Copied!
            </span>
          )}
          {onCopy && (
            <span className="absolute top-2 right-2 text-ui-xs px-1.5 py-0.5 rounded-full bg-surface4 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to copy
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

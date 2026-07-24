import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';

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
  return (
    <div className={`rounded-md border ${className}`} style={{ height }}>
      <ScrollArea className="h-full">
        <div className={`p-2 transition-colors group relative ${onCopy ? 'cursor-pointer hover:bg-surface4/50' : ''}`}>
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy code"
              className="absolute inset-0 z-10 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent1"
            />
          )}
          <pre className="text-ui-xs whitespace-pre-wrap font-mono pointer-events-none">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <span className="text-ui-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {isCopied && (
            <span className="absolute top-2 right-2 z-20 text-ui-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 pointer-events-none">
              Copied!
            </span>
          )}
          {onCopy && (
            <span className="absolute top-2 right-2 z-20 text-ui-xs px-1.5 py-0.5 rounded-full bg-surface4 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Click to copy
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

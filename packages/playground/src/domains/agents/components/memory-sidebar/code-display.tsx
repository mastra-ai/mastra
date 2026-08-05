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
        <div className={`group relative p-2 transition-colors ${onCopy ? 'hover:bg-surface4/50 cursor-pointer' : ''}`}>
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy code"
              className="focus-visible:ring-accent1 absolute inset-0 z-10 rounded-md focus-visible:ring-2 focus-visible:outline-hidden"
            />
          )}
          <pre className="text-ui-xs pointer-events-none font-mono whitespace-pre-wrap">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <span className="text-ui-xs rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-yellow-500">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {isCopied && (
            <span className="text-ui-xs pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-green-500/20 px-1.5 py-0.5 text-green-500">
              Copied!
            </span>
          )}
          {onCopy && (
            <span className="text-ui-xs bg-surface4 text-neutral4 pointer-events-none absolute top-2 right-2 z-20 rounded-full px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              Click to copy
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

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
        <div className={`group relative p-2 transition-colors ${onCopy ? 'cursor-pointer hover:bg-surface4/50' : ''}`}>
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy code"
              className="absolute inset-0 z-10 rounded-md focus-visible:ring-2 focus-visible:ring-accent1 focus-visible:outline-hidden"
            />
          )}
          <pre className="pointer-events-none font-mono text-ui-xs whitespace-pre-wrap">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-ui-xs text-yellow-500">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {isCopied && (
            <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-green-500/20 px-1.5 py-0.5 text-ui-xs text-green-500">
              Copied!
            </span>
          )}
          {onCopy && (
            <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-surface4 px-1.5 py-0.5 text-ui-xs text-neutral4 opacity-0 transition-opacity group-hover:opacity-100">
              Click to copy
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

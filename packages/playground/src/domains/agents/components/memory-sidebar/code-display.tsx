import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';

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
        <div className={`group relative p-2 ${onCopy ? 'cursor-pointer hover:bg-fill-subtle' : ''}`}>
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy code"
              className={`absolute inset-0 z-10 rounded-md ${focusRingInset}`}
            />
          )}
          <pre className="pointer-events-none text-meta whitespace-pre-wrap">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <span className="rounded-full bg-warning-subtle px-1.5 py-0.5 text-meta text-warning-subtle-foreground">
                Draft - Save changes to apply
              </span>
            </div>
          )}
          {isCopied && (
            <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-success-subtle px-1.5 py-0.5 text-meta text-success-subtle-foreground">
              Copied!
            </span>
          )}
          {onCopy && (
            <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-full bg-muted px-1.5 py-0.5 text-meta text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              Click to copy
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

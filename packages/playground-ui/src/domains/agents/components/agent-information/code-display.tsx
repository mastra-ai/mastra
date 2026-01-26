import { ScrollArea } from '@/ds/components/ScrollArea';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

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
    <div className={`rounded-md border ${className}`} style={{ height }} data-testid="code-display">
      <ScrollArea className="h-full">
        <div className="p-2 cursor-pointer hover:bg-surface4/50 transition-colors group relative" onClick={onCopy}>
          <pre className="text-ui-xs whitespace-pre-wrap font-mono">{content}</pre>
          {isDraft && (
            <div className="mt-1.5">
              <Badge variant="warning">Draft - Save changes to apply</Badge>
            </div>
          )}
          {isCopied && (
            <Badge variant="success" className="absolute top-2 right-2">
              Copied!
            </Badge>
          )}
          {onCopy && (
            <Txt
              variant="ui-xs"
              className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-surface4 text-neutral4 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Click to copy
            </Txt>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

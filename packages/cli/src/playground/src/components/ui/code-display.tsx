import { ScrollArea } from '@/components/ui/scroll-area';

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
    <ScrollArea className={`h-[${height}] rounded-md border bg-mastra-bg-2 ${className}`}>
      <div className="p-2 cursor-pointer hover:bg-mastra-bg-3/50 transition-colors group relative" onClick={onCopy}>
        <pre className="text-[10px] whitespace-pre-wrap font-mono">{content}</pre>
        {isDraft && (
          <div className="mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
              Draft - Save changes to apply
            </span>
          </div>
        )}
        {isCopied && (
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
            Copied!
          </span>
        )}
        {onCopy && (
          <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-mastra-bg-3 text-mastra-el-4 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to copy
          </span>
        )}
      </div>
    </ScrollArea>
  );
}

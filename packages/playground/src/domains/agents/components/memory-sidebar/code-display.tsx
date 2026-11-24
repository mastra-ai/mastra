import { Code } from '@mastra/playground-ui/components/Code';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';

interface CodeDisplayProps {
  content: string;
  height?: string;
  isDraft?: boolean;
  className?: string;
}

export function CodeDisplay({ content, height = '150px', isDraft = false, className = '' }: CodeDisplayProps) {
  return (
    <div className={`rounded-md border ${className}`} style={{ height }}>
      <ScrollArea className="h-full">
        <div className="p-2">
          <Code className="text-meta whitespace-pre-wrap" code={content} />
          {isDraft && (
            <div className="mt-1.5">
              <Txt
                as="span"
                variant="meta"
                className="rounded-full bg-warning-subtle px-1.5 py-0.5 text-warning-subtle-foreground"
              >
                Draft: save changes to apply
              </Txt>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

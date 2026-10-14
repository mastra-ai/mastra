import { Code } from '@mastra/playground-ui/components/Code';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';

export interface ComparisonPayloadProps {
  value: unknown;
}

/** A payload (input, ground truth, output): strings as markdown, anything else as JSON. Frame it with a `framed` `ComparisonSection`. */
export function ComparisonPayload({ value }: ComparisonPayloadProps) {
  return (
    <div className="min-w-0 p-3 text-foreground">
      {typeof value === 'string' ? (
        <MarkdownRenderer>{value}</MarkdownRenderer>
      ) : (
        <Code
          code={JSON.stringify(value ?? null, null, 2)}
          lang="json"
          className="text-caption text-wrap break-all text-muted-foreground"
        />
      )}
    </div>
  );
}

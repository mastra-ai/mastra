import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Code } from '@mastra/playground-ui/components/Code';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';

export interface ComparisonPayloadProps {
  value: unknown;
}

/** A payload (input, ground truth, output) in a card: strings as markdown, anything else as JSON. */
export function ComparisonPayload({ value }: ComparisonPayloadProps) {
  return (
    <Card className="min-w-0">
      <CardContent className="text-foreground">
        {typeof value === 'string' ? (
          <MarkdownRenderer>{value}</MarkdownRenderer>
        ) : (
          <Code
            code={JSON.stringify(value ?? null, null, 2)}
            lang="json"
            className="text-caption text-wrap break-all text-muted-foreground"
          />
        )}
      </CardContent>
    </Card>
  );
}

import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { ExternalLinkIcon, Check, Copy } from 'lucide-react';

const DOCS_URL = 'https://mastra.ai/docs/evals/datasets';

export const EXAMPLE_JSON = `[
  {
    "input": "How do I reset my password?",
    "groundTruth": "Use the “Forgot password” link on the sign-in page.",
    "metadata": { "topic": "account" }
  }
]`;

const FIELDS = [
  { name: 'input', description: 'What the agent receives. A string or any JSON value.', required: true },
  { name: 'groundTruth', description: 'Expected answer used by scorers.', required: false },
  { name: 'metadata', description: 'Any object, useful for filtering and grouping.', required: false },
];

export function JSONFormatPanel() {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: EXAMPLE_JSON, showToast: false });

  return (
    <div className="flex flex-col gap-4">
      <p className="flex h-8 items-center text-column text-foreground">Each item looks like this</p>

      <dl className="divide-y divide-border rounded-lg border border-border">
        {FIELDS.map(field => (
          <div key={field.name} className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2.5">
            <dt className="text-meta text-foreground">
              <InlineCode>{field.name}</InlineCode>
            </dt>
            <dd className="flex flex-col items-start gap-1.5 text-meta text-muted-foreground">
              <span>{field.description}</span>
              {field.required ? (
                <Badge variant="green" size="xs">
                  required
                </Badge>
              ) : (
                <Badge variant="neutral" emphasis="muted" size="xs">
                  optional
                </Badge>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-card py-1.5 pr-1.5 pl-3">
          <Txt as="span" variant="meta" tone="muted" font="mono">
            example.json
          </Txt>
          <Button icon={isCopied ? <Check /> : <Copy />} variant="ghost" size="sm" onClick={handleCopy}>
            {isCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <CodeEditor
          variant="embedded"
          language="json"
          editable={false}
          lineNumbers={false}
          showCopyButton={false}
          value={EXAMPLE_JSON}
          className="p-3"
        />
      </div>

      <Button
        variant="ghost"
        render={<a href={DOCS_URL} target="_blank" rel="noopener noreferrer" />}

        className="self-start"
        icon={<ExternalLinkIcon />}
      >
        Datasets documentation
      </Button>
    </div>
  );
}

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { InlineCode } from '@/ds/components/InlineCode';
import { Txt } from '@/ds/components/Txt';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import { textStyle } from '@/ds/primitives/text';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

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
      <Txt variant="column" tone="ink" className="flex h-8 items-center">
        Each item looks like this
      </Txt>

      <dl className="divide-y divide-border rounded-lg border border-border">
        {FIELDS.map(field => (
          <div key={field.name} className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2.5">
            <dt className={textStyle({ tone: 'ink', variant: 'meta' })}>
              <InlineCode>{field.name}</InlineCode>
            </dt>
            <dd className="flex flex-col items-start gap-1.5 text-muted-foreground">
              <Txt as="span" variant="meta">
                {field.description}
              </Txt>
              {field.required ? (
                <Badge variant="success" size="xs">
                  required
                </Badge>
              ) : (
                <Badge variant="neutral" emphasis="subtle" size="xs">
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
          <Button
            icon={isCopied ? <IconCheckmark2Medium /> : <IconSquareBehindSquare1 />}
            variant="ghost"
            size="sm"
            onClick={handleCopy}
          >
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
        icon={<IconSquareArrowTopRight />}
      >
        Datasets documentation
      </Button>
    </div>
  );
}

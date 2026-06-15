import { Fragment } from 'react';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { looksLikeMarkdown } from '@/lib/json-utils';
import { cn } from '@/lib/utils';

function StringValue({ value }: { value: string }) {
  if (looksLikeMarkdown(value)) {
    return (
      <div className="mt-1 text-ui-sm text-neutral4">
        <MarkdownRenderer>{value}</MarkdownRenderer>
      </div>
    );
  }
  return (
    <span className="font-mono text-ui-sm text-accent1 break-all whitespace-pre-wrap">
      {value.replace(/\\n/g, '\n')}
    </span>
  );
}

function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="font-mono text-ui-sm text-accent6">null</span>;
  if (typeof value === 'boolean') return <span className="font-mono text-ui-sm text-accent6">{String(value)}</span>;
  if (typeof value === 'number') return <span className="font-mono text-ui-sm text-accent5">{value}</span>;
  return <StringValue value={value} />;
}

function JsonNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <PrimitiveValue value={value as string | number | boolean | null} />;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span className="font-mono text-ui-sm text-neutral2">[]</span>;
    return (
      <div className={cn('flex flex-col gap-2', depth > 0 && 'pl-4 border-l border-border1 ml-1')}>
        {value.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="font-mono text-ui-sm text-neutral2 shrink-0">{i}</span>
            <JsonNode value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return <span className="font-mono text-ui-sm text-neutral2">{'{}'}</span>;
    return (
      <div className={cn('flex flex-col gap-3', depth > 0 && 'pl-4 border-l border-border1 ml-1')}>
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-ui-xs uppercase tracking-wider text-neutral2">{k}</span>
              <JsonNode value={v} depth={depth + 1} />
            </div>
          </Fragment>
        ))}
      </div>
    );
  }

  return null;
}

export interface JsonPrettyRendererProps {
  value: unknown;
}

export function JsonPrettyRenderer({ value }: JsonPrettyRendererProps) {
  return (
    <div className="text-neutral4 text-ui-sm">
      <JsonNode value={value} depth={0} />
    </div>
  );
}

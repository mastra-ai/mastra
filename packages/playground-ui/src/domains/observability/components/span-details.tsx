import { SideDialog } from '@/components/ui/elements';
import { AISpanRecord } from '@mastra/core';

interface SpanDetailsProps {
  span?: AISpanRecord;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
}

export function SpanDetails({ span, onScorerTriggered }: SpanDetailsProps) {
  if (!span) {
    return null;
  }

  return (
    <>
      <SideDialog.CodeSection title="Input" codeStr={JSON.stringify(span.input || null, null, 2)} />
      <SideDialog.CodeSection title="Output" codeStr={JSON.stringify(span.output || null, null, 2)} />
      <SideDialog.CodeSection title="Metadata" codeStr={JSON.stringify(span.metadata || null, null, 2)} />
      <SideDialog.CodeSection title="Attributes" codeStr={JSON.stringify(span.attributes || null, null, 2)} />
    </>
  );
}

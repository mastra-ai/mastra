import { SideDialog } from '@/components/ui/elements';
import { SpanRecord } from '@mastra/core/storage';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';

interface SpanDetailsProps {
  span?: SpanRecord;
}

export function SpanDetails({ span }: SpanDetailsProps) {
  if (!span) {
    return null;
  }

  return (
    <>
      <SideDialog.CodeSection
        title="Input"
        icon={<FileInputIcon />}
        codeStr={JSON.stringify(span.input || null, null, 2)}
      />
      <SideDialog.CodeSection
        title="Output"
        icon={<FileOutputIcon />}
        codeStr={JSON.stringify(span.output || null, null, 2)}
      />
      <SideDialog.CodeSection
        title="Metadata"
        icon={<BracesIcon />}
        codeStr={JSON.stringify(span.metadata || null, null, 2)}
      />
      <SideDialog.CodeSection
        title="Attributes"
        icon={<BracesIcon />}
        codeStr={JSON.stringify(span.attributes || null, null, 2)}
      />
    </>
  );
}

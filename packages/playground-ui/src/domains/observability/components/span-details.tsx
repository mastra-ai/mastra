import { SideDialog } from '@/components/ui/elements';
import { SpanRecord } from '@mastra/core/storage';
import { AlertTriangleIcon, BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import { isTokenLimitExceeded, getTokenLimitMessage } from '../utils/span-utils';

interface SpanDetailsProps {
  span?: SpanRecord;
}

export function SpanDetails({ span }: SpanDetailsProps) {
  if (!span) {
    return null;
  }

  const tokenLimitExceeded = isTokenLimitExceeded(span);

  return (
    <>
      {/* Show prominent warning when token limit is exceeded */}
      {tokenLimitExceeded && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="text-warning mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-warning mb-1">Token Limit Exceeded</h4>
              <p className="text-sm text-mastra-el-3 whitespace-pre-line">{getTokenLimitMessage(span)}</p>
            </div>
          </div>
        </div>
      )}

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

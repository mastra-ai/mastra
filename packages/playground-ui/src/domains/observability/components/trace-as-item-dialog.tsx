'use client';

import { EyeIcon } from 'lucide-react';
import type { SpanRecord } from '@mastra/core/storage';
import type { SideDialogRootProps } from '@/ds/components/SideDialog';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { SaveAsDatasetItemDialog } from '@/domains/datasets/components/save-as-dataset-item-dialog';

type TraceAsItemDialogProps = {
  traceDetails?: SpanRecord;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
};

function getInitialInput(traceDetails?: SpanRecord): string {
  if (traceDetails?.input == null) return '{}';

  // Unwrap legacy { messages } wrapper from agent_run spans so the dataset item stores a valid MessageListInput
  const spanInput = traceDetails.input as Record<string, unknown> | undefined;
  const isWrappedAgentInput =
    traceDetails.spanType === 'agent_run' &&
    spanInput &&
    typeof spanInput === 'object' &&
    !Array.isArray(spanInput) &&
    'messages' in spanInput;
  const rawInput = isWrappedAgentInput ? spanInput.messages : traceDetails.input;

  return JSON.stringify(rawInput, null, 2);
}

export function TraceAsItemDialog({ traceDetails, traceId, isOpen, onClose, level = 2 }: TraceAsItemDialogProps) {
  return (
    <SaveAsDatasetItemDialog
      initialInput={getInitialInput(traceDetails)}
      initialGroundTruth={traceDetails?.output != null ? JSON.stringify(traceDetails.output, null, 2) : ''}
      breadcrumb={
        <TextAndIcon>
          <EyeIcon /> {getShortId(traceId)}
        </TextAndIcon>
      }
      isOpen={isOpen}
      onClose={onClose}
      level={level}
    />
  );
}

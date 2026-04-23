import type { FeedbackRecord } from '@mastra/core/storage';
import { KeyValueList, SideDialog, TextAndIcon, Sections } from '@mastra/playground-ui';
import { format } from 'date-fns/format';
import { HashIcon, MessageSquareIcon } from 'lucide-react';

type FeedbackDialogProps = {
  feedback?: FeedbackRecord;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

function formatValue(fb: FeedbackRecord): string {
  if (fb.feedbackType === 'thumbs') {
    if (fb.value === 1) return '\u{1F44D} Positive (1)';
    if (fb.value === 0 || fb.value === -1) return '\u{1F44E} Negative';
    return String(fb.value);
  }
  if (fb.feedbackType === 'rating') {
    return String(fb.value);
  }
  if (fb.feedbackType === 'comment') {
    return String(fb.value ?? fb.comment ?? '-');
  }
  return String(fb.value ?? '-');
}

export function FeedbackDialog({ feedback, isOpen, onClose, onNext, onPrevious }: FeedbackDialogProps) {
  const metadataStr =
    feedback?.metadata && Object.keys(feedback.metadata).length > 0
      ? JSON.stringify(feedback.metadata, null, 2)
      : undefined;

  return (
    <SideDialog
      dialogTitle="Feedback Detail"
      dialogDescription="View feedback details"
      isOpen={isOpen}
      onClose={onClose}
      level={3}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <MessageSquareIcon /> Feedback
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <MessageSquareIcon /> Feedback
          </SideDialog.Heading>
          {feedback?.traceId && (
            <TextAndIcon>
              <HashIcon /> {feedback.traceId}
            </TextAndIcon>
          )}
        </SideDialog.Header>

        <Sections>
          <KeyValueList
            data={[
              {
                label: 'Created at',
                value: feedback?.timestamp ? format(new Date(feedback.timestamp), 'MMM d, h:mm:ss aaa') : 'n/a',
                key: 'timestamp',
              },
              {
                label: 'Type',
                value: feedback?.feedbackType ?? 'n/a',
                key: 'type',
              },
              {
                label: 'Value',
                value: feedback ? formatValue(feedback) : 'n/a',
                key: 'value',
              },
              ...(feedback?.comment
                ? [
                    {
                      label: 'Comment',
                      value: feedback.comment,
                      key: 'comment',
                    },
                  ]
                : []),
              {
                label: 'Source',
                value: feedback?.feedbackSource ?? feedback?.source ?? 'n/a',
                key: 'source',
              },
              ...(feedback?.feedbackUserId
                ? [
                    {
                      label: 'User',
                      value: feedback.feedbackUserId,
                      key: 'userId',
                    },
                  ]
                : []),
              ...(feedback?.traceId
                ? [
                    {
                      label: 'Trace ID',
                      value: feedback.traceId,
                      key: 'traceId',
                    },
                  ]
                : []),
              ...(feedback?.spanId
                ? [
                    {
                      label: 'Span ID',
                      value: feedback.spanId,
                      key: 'spanId',
                    },
                  ]
                : []),
            ]}
          />

          {metadataStr && (
            <SideDialog.CodeSection title="Metadata" icon={<HashIcon />} codeStr={metadataStr} simplified={true} />
          )}
        </Sections>
      </SideDialog.Content>
    </SideDialog>
  );
}

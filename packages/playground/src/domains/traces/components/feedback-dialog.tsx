import type { FeedbackRecord } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import { Sections } from '@mastra/playground-ui/components/Sections';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { format } from 'date-fns/format';
import { DatabaseIcon, HashIcon, MessageSquareIcon } from 'lucide-react';
import { Link } from 'react-router';

type FeedbackDialogProps = {
  feedback?: FeedbackRecord;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  /** Show a "View trace" deep-link to the feedback's trace (used outside the trace detail view). */
  showTraceLink?: boolean;
  /** Called to promote the feedback's trace into a dataset item. Rendered only when the feedback has a traceId. */
  onAddToDataset?: () => void;
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

export function FeedbackDialog({
  feedback,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  showTraceLink,
  onAddToDataset,
}: FeedbackDialogProps) {
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
          {showTraceLink && feedback?.traceId && (
            <Button as={Link} to={`/traces/${feedback.traceId}?tab=feedback`} size="sm">
              View trace
            </Button>
          )}
          {onAddToDataset && feedback?.traceId && (
            <Button size="sm" onClick={onAddToDataset}>
              <TextAndIcon>
                <DatabaseIcon /> Add to dataset
              </TextAndIcon>
            </Button>
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

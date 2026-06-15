import { Badge, Icon, MarkdownRenderer, Notice, cn } from '@mastra/playground-ui';
import { CheckCircleIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

import type { MessageMetadata } from '../message-metadata';
import { TripwireNotice } from '../tripwire-notice';

export interface MessageTextProps {
  text: string;
  metadata: MessageMetadata | undefined;
}

/**
 * Part-level text renderer. Markdown for normal text, plus the legacy
 * error/completion handling previously in `ErrorAwareText` (which read part
 * metadata).
 */
export const MessageText = ({ text, metadata }: MessageTextProps) => {
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(false);

  if (metadata?.status === 'tripwire') {
    return <TripwireNotice reason={text} tripwire={metadata.tripwire} />;
  }
  if (metadata?.status === 'warning') {
    return (
      <Notice variant="warning" title="Warning">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    );
  }
  if (metadata?.status === 'error') {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{text}</Notice.Message>
      </Notice>
    );
  }

  const taskCompleteResult = metadata?.completionResult;
  if (taskCompleteResult) {
    return (
      <div className="mb-2 space-y-2">
        <button onClick={() => setCollapsedCompletionCheck(s => !s)} className="flex items-center gap-2">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', collapsedCompletionCheck ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge variant="info" icon={<CheckCircleIcon />}>
            {collapsedCompletionCheck ? 'Show' : 'Hide'} completion check
          </Badge>
        </button>
        {!collapsedCompletionCheck && (
          <Notice variant="info" title={taskCompleteResult?.passed ? 'Complete' : 'Not Complete'}>
            <MarkdownRenderer>{text}</MarkdownRenderer>
          </Notice>
        )}
      </div>
    );
  }

  const trimmedText = text.trim();
  if (trimmedText.startsWith('__ERROR__:')) {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{trimmedText.substring('__ERROR__:'.length)}</Notice.Message>
      </Notice>
    );
  }
  if (trimmedText.startsWith('Error:')) {
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{trimmedText.substring('Error:'.length).trim()}</Notice.Message>
      </Notice>
    );
  }

  return <MarkdownRenderer>{text}</MarkdownRenderer>;
};

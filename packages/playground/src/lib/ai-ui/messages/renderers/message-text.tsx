import { Badge } from '@mastra/playground-ui/components/Badge';
import { MarkdownRenderer, type MarkdownExternalLinkTarget } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CheckCircleIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

import type { MessageMetadata } from '../message-metadata';
import { TripwireNotice } from '../tripwire-notice';
import { errorMessage, messageTextKind } from './message-text-kind';

export interface MessageTextProps {
  text: string;
  metadata: MessageMetadata | undefined;
  externalLinkTarget?: MarkdownExternalLinkTarget;
  streaming?: boolean;
}

/**
 * Part-level text renderer. Markdown for normal text, plus the legacy
 * error/completion handling previously in `ErrorAwareText` (which read part
 * metadata).
 */
export const MessageText = ({ text, metadata, externalLinkTarget, streaming }: MessageTextProps) => {
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(false);

  switch (messageTextKind(text, metadata)) {
    case 'tripwire':
      return <TripwireNotice reason={text} tripwire={metadata?.tripwire} />;

    case 'warning':
      return (
        <Notice variant="warning" title="Warning">
          <Notice.Message>{text}</Notice.Message>
        </Notice>
      );

    case 'error':
      return (
        <Notice variant="destructive" title="Error">
          <Notice.Message>{errorMessage(text)}</Notice.Message>
        </Notice>
      );

    case 'completion':
      return (
        <div className="mb-2 space-y-2">
          <button onClick={() => setCollapsedCompletionCheck(s => !s)} className="flex items-center gap-2">
            <Icon>
              <ChevronUpIcon className={cn('transition-all', collapsedCompletionCheck ? 'rotate-90' : 'rotate-180')} />
            </Icon>
            <Badge variant="blue" icon={<CheckCircleIcon />}>
              {collapsedCompletionCheck ? 'Show' : 'Hide'} completion check
            </Badge>
          </button>
          {!collapsedCompletionCheck && (
            <Notice variant="info" title={metadata?.completionResult?.passed ? 'Complete' : 'Not Complete'}>
              <MarkdownRenderer externalLinkTarget={externalLinkTarget}>{text}</MarkdownRenderer>
            </Notice>
          )}
        </div>
      );

    default:
      return (
        <MarkdownRenderer externalLinkTarget={externalLinkTarget} streaming={Boolean(streaming)}>
          {text}
        </MarkdownRenderer>
      );
  }
};

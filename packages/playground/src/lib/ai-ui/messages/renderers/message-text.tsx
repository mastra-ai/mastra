import { Tool, ToolContent, ToolHeader, ToolIcon } from '@mastra/playground-ui/components/ai/tool-call';
import { Card } from '@mastra/playground-ui/components/Card';
import { MarkdownRenderer, type MarkdownExternalLinkTarget } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { CheckCircleIcon } from 'lucide-react';
import { useState } from 'react';

import type { MessageMetadata } from '../message-metadata';
import { TripwireNotice } from '../tripwire-notice';

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
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(true);

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

  const taskCompleteResult = metadata?.completionResult ?? metadata?.isTaskCompleteResult;
  if (taskCompleteResult) {
    return (
      <Tool
        className="mb-2"
        status={taskCompleteResult.passed ? 'success' : 'error'}
        open={!collapsedCompletionCheck}
        onOpenChange={open => setCollapsedCompletionCheck(!open)}
        aria-label="Completion check"
      >
        <ToolHeader>
          <ToolIcon tooltip="Completion check">
            <CheckCircleIcon className="text-accent3" />
          </ToolIcon>
          {collapsedCompletionCheck ? 'Show' : 'Hide'} completion check
        </ToolHeader>
        <ToolContent>
          <Card role="group" aria-label="Completion check result" className="text-neutral5 space-y-3 p-3">
            <p className="text-ui-xs text-neutral4 font-medium">
              {taskCompleteResult?.passed ? 'Complete' : 'Not Complete'}
            </p>
            <MarkdownRenderer externalLinkTarget={externalLinkTarget}>{text}</MarkdownRenderer>
          </Card>
        </ToolContent>
      </Tool>
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

  return (
    <MarkdownRenderer externalLinkTarget={externalLinkTarget} streaming={streaming}>
      {text}
    </MarkdownRenderer>
  );
};

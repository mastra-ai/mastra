import { useAssistantState } from '@assistant-ui/react';
import { Notice, Badge, Icon, cn } from '@mastra/playground-ui';
import type { MastraUIMessageMetadata } from '@mastra/react';
import { CheckCircleIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { MarkdownText } from './markdown-text';
import { TripwireNotice } from './tripwire-notice';

export const ErrorAwareText = () => {
  const part = useAssistantState(({ part }) => part);
  const [collapsedCompletionCheck, setCollapsedCompletionCheck] = useState(false);

  // Get text from the part - it's a TextPart so it has a text property
  const text = (part as any).text || '';
  const metadata = ((part as any).metadata || {}) as MastraUIMessageMetadata;

  // Handle tripwire status with specialized notice component
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
            <MarkdownText />
          </Notice>
        )}
      </div>
    );
  }

  try {
    // Check if this is an error message (trim whitespace first)
    const trimmedText = text.trim();

    // Check for both old __ERROR__: prefix (for backwards compatibility)
    // and new plain "Error:" format
    if (trimmedText.startsWith('__ERROR__:')) {
      const errorMessage = trimmedText.substring('__ERROR__:'.length);

      return (
        <Notice variant="destructive" title="Error">
          <Notice.Message>{errorMessage}</Notice.Message>
        </Notice>
      );
    } else if (trimmedText.startsWith('Error:')) {
      // Handle plain error messages without special prefix
      const errorMessage = trimmedText.substring('Error:'.length).trim();

      return (
        <Notice variant="destructive" title="Error">
          <Notice.Message>{errorMessage}</Notice.Message>
        </Notice>
      );
    }

    // For regular text, use the normal MarkdownText component
    return <MarkdownText />;
  } catch {
    // Fallback to displaying the raw text if something goes wrong
    return (
      <Notice variant="destructive" title="Error">
        <Notice.Message>{String(text)}</Notice.Message>
      </Notice>
    );
  }
};

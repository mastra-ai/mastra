import { useAssistantState } from '@assistant-ui/react';
import { Alert, AlertDescription, AlertTitle, Badge, Icon, cn } from '@mastra/playground-ui';
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
      <Alert variant="warning">
        <AlertTitle as="h5">Warning</AlertTitle>
        <AlertDescription as="p">{text}</AlertDescription>
      </Alert>
    );
  }

  if (metadata?.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle as="h5">Error</AlertTitle>
        <AlertDescription as="p">{text}</AlertDescription>
      </Alert>
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
          <Alert variant="info">
            <AlertTitle as="h5">{taskCompleteResult?.passed ? 'Complete' : 'Not Complete'}</AlertTitle>
            <MarkdownText />
          </Alert>
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
        <Alert variant="destructive">
          <AlertTitle as="h5">Error</AlertTitle>
          <AlertDescription as="p">{errorMessage}</AlertDescription>
        </Alert>
      );
    } else if (trimmedText.startsWith('Error:')) {
      // Handle plain error messages without special prefix
      const errorMessage = trimmedText.substring('Error:'.length).trim();

      return (
        <Alert variant="destructive">
          <AlertTitle as="h5">Error</AlertTitle>
          <AlertDescription as="p">{errorMessage}</AlertDescription>
        </Alert>
      );
    }

    // For regular text, use the normal MarkdownText component
    return <MarkdownText />;
  } catch {
    // Fallback to displaying the raw text if something goes wrong
    return (
      <Alert variant="destructive">
        <AlertTitle as="h5">Error</AlertTitle>
        <AlertDescription as="p">{String(text)}</AlertDescription>
      </Alert>
    );
  }
};

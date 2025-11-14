'use client';

import { useMessagePart } from '@assistant-ui/react';
import { AlertCircle } from 'lucide-react';
import { MarkdownText } from './markdown-text';
import { MastraUIMessageMetadata } from '@mastra/react';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';

export const ErrorAwareText = () => {
  const part = useMessagePart();

  // Get text from the part - it's a TextPart so it has a text property
  const text = (part as any).text || '';
  const metadata = ((part as any).metadata || {}) as MastraUIMessageMetadata;

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

  try {
    // Check if this is an error message (trim whitespace first)
    const trimmedText = text.trim();

    // Check for both old __ERROR__: prefix (for backwards compatibility)
    // and new plain "Error:" format
    if (trimmedText.startsWith('__ERROR__:')) {
      const errorMessage = trimmedText.substring('__ERROR__:'.length);

      return (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        </div>
      );
    } else if (trimmedText.startsWith('Error:')) {
      // Handle plain error messages without special prefix
      const errorMessage = trimmedText.substring('Error:'.length).trim();

      return (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        </div>
      );
    }

    // For regular text, use the normal MarkdownText component
    return <MarkdownText />;
  } catch (error) {
    // Fallback to displaying the raw text if something goes wrong
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
        <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
          <p className="text-sm text-red-700 dark:text-red-300">{String(text)}</p>
        </div>
      </div>
    );
  }
};

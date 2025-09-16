'use client';

import { TextMessagePart } from '@assistant-ui/react';
import { AlertCircle } from 'lucide-react';
import { MarkdownText } from './markdown-text';

export const ErrorAwareText = ({ text }: TextMessagePart) => {
  // Check if this is an error message
  if (text.startsWith('__ERROR__:')) {
    const errorMessage = text.substring('__ERROR__:'.length);

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
};

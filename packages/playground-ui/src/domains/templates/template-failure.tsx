import { FrownIcon } from 'lucide-react';
import { Container } from './shared';
import { cn } from '@/lib/utils';

type TemplateFailureProps = {
  errorMsg?: string;
};

export function TemplateFailure({ errorMsg }: TemplateFailureProps) {
  const isSchemaError = errorMsg?.includes('Invalid schema for function');

  const getUserFriendlyMessage = () => {
    if (isSchemaError) {
      return 'There was an issue with the AI model configuration. This may be related to the selected model or AI SDK version compatibility.';
    }
    return 'An unexpected error occurred during template installation.';
  };

  return (
    <Container className="space-y-4 text-icon3 mb-[2rem] content-center max-w-2xl mx-auto">
      {/* Main Error Display */}
      <div
        className={cn(
          'grid items-center justify-items-center gap-[1rem] content-center',
          '[&>svg]:w-[2rem] [&>svg]:h-[2rem]',
        )}
      >
        <FrownIcon />
        <div className="text-center space-y-2">
          <p className="text-[0.875rem] font-medium text-icon5">Template Installation Failed</p>
          <p className="text-[0.875rem] text-icon3">{getUserFriendlyMessage()}</p>
        </div>
      </div>

      {/* Expandable details */}
      {errorMsg && (
        <details className="text-xs">
          <summary className="cursor-pointer text-icon3 hover:text-icon4 select-none text-center">Show Details</summary>
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-60 text-left">
            <div className="whitespace-pre-wrap break-words">{errorMsg}</div>
          </div>
        </details>
      )}
    </Container>
  );
}

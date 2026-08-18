import { cn } from '@mastra/playground-ui/utils/cn';
import { FrownIcon, AlertTriangleIcon } from 'lucide-react';
import { Container } from './shared';

type TemplateFailureProps = {
  errorMsg?: string;
  validationErrors?: any[];
};

export function TemplateFailure({ errorMsg, validationErrors }: TemplateFailureProps) {
  const errorString = typeof errorMsg === 'string' ? errorMsg : errorMsg != null ? String(errorMsg) : undefined;
  const isSchemaError = errorString?.includes('Invalid schema for function');
  const isValidationError =
    errorString?.includes('validation issue') || (validationErrors && validationErrors.length > 0);

  const getUserFriendlyMessage = () => {
    if (isValidationError) {
      return 'Template installation completed but some validation issues remain. The template may still be functional, but you should review and fix these issues.';
    }
    if (isSchemaError) {
      return 'There was an issue with the AI model configuration. This may be related to the selected model or AI SDK version compatibility.';
    }
    return 'An unexpected error occurred during template installation.';
  };

  const getIconAndTitle = () => {
    if (isValidationError) {
      return {
        icon: <AlertTriangleIcon className="text-yellow-500" />,
        title: 'Template Installed with Warnings',
      };
    }
    return {
      icon: <FrownIcon />,
      title: 'Template Installation Failed',
    };
  };

  const { icon, title } = getIconAndTitle();

  return (
    <Container className="text-neutral3 mb-8 content-center space-y-4">
      {/* Main Error Display */}
      <div className={cn('grid items-center justify-items-center gap-4 content-center', '[&>svg]:w-8 [&>svg]:h-8')}>
        {icon}
        <div className="space-y-2 text-center">
          <p className="text-ui-md text-neutral5 font-medium">{title}</p>
          <p className="text-ui-md text-neutral3">{getUserFriendlyMessage()}</p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors && validationErrors.length > 0 && (
        <details className="text-xs">
          <summary className="text-neutral3 hover:text-neutral4 cursor-pointer text-center select-none">
            Show Validation Issues ({validationErrors.length})
          </summary>
          <div className="mt-4 max-h-60 space-y-2 overflow-auto rounded bg-gray-100 p-3 text-left text-xs dark:bg-gray-800">
            {validationErrors.map((error, index) => (
              <div key={index} className="border-l-2 border-red-400 pl-2">
                <div className="font-medium text-red-600 dark:text-red-400">
                  {error.type === 'typescript' ? '🔴 TypeScript Error' : '⚠️ Lint Error'}
                </div>
                <div className="mt-1 font-mono text-xs wrap-break-word whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {error.message}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* General Error Details */}
      {errorString && !isValidationError && (
        <details className="text-xs">
          <summary className="text-neutral3 hover:text-neutral4 cursor-pointer text-center select-none">
            Show Details
          </summary>
          <div className="mt-4 max-h-60 overflow-auto rounded bg-gray-100 p-3 text-left font-mono text-xs dark:bg-gray-800">
            <div className="wrap-break-word whitespace-pre-wrap">{errorString}</div>
          </div>
        </details>
      )}
    </Container>
  );
}

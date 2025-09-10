import { FrownIcon, AlertTriangleIcon } from 'lucide-react';
import { Container } from './shared';
import { cn } from '@/lib/utils';

type TemplateFailureProps = {
  errorMsg?: string;
  validationErrors?: any[];
};

export function TemplateFailure({ errorMsg, validationErrors }: TemplateFailureProps) {
  const isSchemaError = errorMsg?.includes('Invalid schema for function');
  const isValidationError = errorMsg?.includes('validation issue') || (validationErrors && validationErrors.length > 0);

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
    <Container className="space-y-4 text-icon3 mb-[2rem] content-center max-w-2xl mx-auto">
      {/* Main Error Display */}
      <div
        className={cn(
          'grid items-center justify-items-center gap-[1rem] content-center',
          '[&>svg]:w-[2rem] [&>svg]:h-[2rem]',
        )}
      >
        {icon}
        <div className="text-center space-y-2">
          <p className="text-[0.875rem] font-medium text-icon5">{title}</p>
          <p className="text-[0.875rem] text-icon3">{getUserFriendlyMessage()}</p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors && validationErrors.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-icon3 hover:text-icon4 select-none text-center">
            Show Validation Issues ({validationErrors.length})
          </summary>
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-60 text-left space-y-2">
            {validationErrors.map((error, index) => (
              <div key={index} className="border-l-2 border-red-400 pl-2">
                <div className="font-medium text-red-600 dark:text-red-400">
                  {error.type === 'typescript' ? '🔴 TypeScript Error' : '⚠️ Lint Error'}
                </div>
                <div className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                  {error.message}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* General Error Details */}
      {errorMsg && !isValidationError && (
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

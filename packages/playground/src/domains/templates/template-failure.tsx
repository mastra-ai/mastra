import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
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
    <Container className="mb-5 content-center space-y-4 text-muted-foreground">
      {/* Main Error Display */}
      <div className={cn('grid content-center items-center justify-items-center gap-4', '[&>svg]:h-8 [&>svg]:w-8')}>
        {icon}
        <div className="space-y-2 text-center">
          <p className="text-subheading text-foreground">{title}</p>
          <p className="text-body text-muted-foreground">{getUserFriendlyMessage()}</p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors && validationErrors.length > 0 && (
        <details className="text-caption">
          <summary className={cn(quietTextHover, 'cursor-pointer text-center select-none')}>
            Show Validation Issues ({validationErrors.length})
          </summary>
          <div className="mt-4 max-h-60 space-y-2 overflow-auto rounded bg-muted p-3 text-left text-caption">
            {validationErrors.map((error, index) => (
              <div key={index} className="border-l-2 border-destructive pl-2">
                <div className="font-medium text-destructive">
                  {error.type === 'typescript' ? '🔴 TypeScript Error' : '⚠️ Lint Error'}
                </div>
                <pre className="mt-1 text-caption wrap-break-word whitespace-pre-wrap text-muted-foreground">
                  {error.message}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* General Error Details */}
      {errorString && !isValidationError && (
        <details className="text-caption">
          <summary className={cn(quietTextHover, 'cursor-pointer text-center select-none')}>Show Details</summary>
          <div className="mt-4 max-h-60 overflow-auto rounded bg-muted p-3 text-left text-caption">
            <pre className="wrap-break-word whitespace-pre-wrap">{errorString}</pre>
          </div>
        </details>
      )}
    </Container>
  );
}

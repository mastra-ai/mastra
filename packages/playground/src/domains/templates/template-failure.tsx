import { Txt } from '@mastra/playground-ui/components/Txt';
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
        icon: <AlertTriangleIcon className="text-warning-foreground" />,
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
          <Txt variant="subheading" tone="ink">
            {title}
          </Txt>
          <Txt tone="muted">{getUserFriendlyMessage()}</Txt>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors && validationErrors.length > 0 && (
        <Txt as="details" variant="caption">
          <summary className={cn(quietTextHover, 'cursor-pointer text-center select-none')}>
            Show Validation Issues ({validationErrors.length})
          </summary>
          <Txt
            as="div"
            variant="caption"
            className="mt-4 max-h-60 space-y-2 overflow-auto rounded bg-muted p-3 text-left"
          >
            {validationErrors.map((error, index) => (
              <div key={index} className="border-l-2 border-destructive-indicator pl-2">
                <Txt as="div" variant="column" className="text-destructive-foreground">
                  {error.type === 'typescript' ? '🔴 TypeScript Error' : '⚠️ Lint Error'}
                </Txt>
                <Txt as="pre" variant="caption" tone="muted" className="mt-1 wrap-break-word whitespace-pre-wrap">
                  {error.message}
                </Txt>
              </div>
            ))}
          </Txt>
        </Txt>
      )}

      {/* General Error Details */}
      {errorString && !isValidationError && (
        <Txt as="details" variant="caption">
          <summary className={cn(quietTextHover, 'cursor-pointer text-center select-none')}>Show Details</summary>
          <Txt as="div" variant="caption" className="mt-4 max-h-60 overflow-auto rounded bg-muted p-3 text-left">
            <pre className="wrap-break-word whitespace-pre-wrap">{errorString}</pre>
          </Txt>
        </Txt>
      )}
    </Container>
  );
}

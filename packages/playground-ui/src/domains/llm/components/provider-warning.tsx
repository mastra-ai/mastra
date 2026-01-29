import { Provider } from '@mastra/client-js';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { TriangleAlert } from 'lucide-react';
import { WarningVariant } from '../types';

export interface ProviderWarningProps {
  /** The provider to display warning for */
  provider: Provider | undefined;
  /** Warning display variant */
  variant?: WarningVariant;
  /** Custom class name */
  className?: string;
}

/**
 * Formats environment variable names for display
 */
const formatEnvVars = (envVar: string | string[] | undefined): string => {
  if (!envVar) return '';
  return Array.isArray(envVar) ? envVar.join(', ') : envVar;
};

/**
 * Returns plural/singular text for environment variable
 */
const getEnvVarText = (envVar: string | string[] | undefined): string => {
  if (Array.isArray(envVar) && envVar.length > 1) {
    return 'variables';
  }
  return 'variable';
};

/**
 * Alert variant for provider not connected warning
 * Used in forms and settings panels
 */
const AlertWarning = ({ provider }: { provider: Provider }) => (
  <div className="pt-2 p-2">
    <Alert variant="warning">
      <AlertTitle as="h5">Provider not connected</AlertTitle>
      <AlertDescription as="p">
        Set the{' '}
        <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
          {formatEnvVars(provider.envVar)}
        </code>{' '}
        environment {getEnvVarText(provider.envVar)} to use this provider.
      </AlertDescription>
    </Alert>
  </div>
);

/**
 * Inline variant for provider not connected warning
 * Used in compact/inline contexts like composer
 */
const InlineWarning = ({ provider }: { provider: Provider }) => (
  <div className="flex items-center gap-1 text-accent6 text-xs">
    <TriangleAlert className="w-3 h-3 shrink-0" />
    <span>
      Set{' '}
      <code className="px-1 py-0.5 bg-accent6Dark rounded text-accent6">
        {formatEnvVars(provider.envVar)}
      </code>{' '}
      to use this provider
    </span>
  </div>
);

/**
 * Reusable warning component for disconnected providers.
 * Supports two variants: 'alert' for forms and 'inline' for compact displays.
 */
export const ProviderWarning = ({
  provider,
  variant = 'alert',
  className,
}: ProviderWarningProps) => {
  // Don't render if no provider or provider is connected
  if (!provider || provider.connected) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <div className={className}>
        <InlineWarning provider={provider} />
      </div>
    );
  }

  return (
    <div className={className}>
      <AlertWarning provider={provider} />
    </div>
  );
};

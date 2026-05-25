import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { Button } from '../Button';
import { cn } from '@/lib/utils';

export type ErrorBoundaryVariant = 'section' | 'inline';

export type ErrorBoundaryFallbackProps = {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  reset: () => void;
};

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback rendered when an error is caught. Receives the error and a reset callback. */
  fallback?: React.ReactNode | ((props: ErrorBoundaryFallbackProps) => React.ReactNode);
  /** Called when an error is caught. Useful for reporting to an error tracker. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * When any value in this array changes between renders, the boundary resets.
   * Useful for clearing an error on route change: `resetKeys={[pathname]}`.
   */
  resetKeys?: ReadonlyArray<unknown>;
  /** Heading shown in the default fallback. */
  title?: string;
  /** Description shown in the default fallback. */
  description?: string;
  /**
   * Controls the default fallback's footprint:
   * - `'section'` (default): fills available height and centers content — use when the boundary wraps a page or region.
   * - `'inline'`: stays compact — use when scoping to a single widget so the rest of the UI is untouched.
   */
  variant?: ErrorBoundaryVariant;
  /** Additional classes applied to the default fallback's outer wrapper. */
  className?: string;
}

type ErrorBoundaryState = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

const INITIAL_STATE: ErrorBoundaryState = { error: null, errorInfo: null };

function keysChanged(prev: ReadonlyArray<unknown> | undefined, next: ReadonlyArray<unknown> | undefined): boolean {
  if (prev === next) return false;
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        if (typeof console !== 'undefined') {
          console.error('[ErrorBoundary] onError handler threw:', handlerError);
        }
      }
    }
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && keysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => {
    this.setState(INITIAL_STATE);
  };

  render() {
    const { error, errorInfo } = this.state;
    const { children, fallback, title, description, variant, className } = this.props;

    if (!error) return children;

    if (typeof fallback === 'function') {
      return fallback({ error, errorInfo, reset: this.reset });
    }

    if (fallback !== undefined) return fallback;

    return (
      <DefaultErrorFallback
        error={error}
        errorInfo={errorInfo}
        reset={this.reset}
        title={title}
        description={description}
        variant={variant ?? 'section'}
        className={className}
      />
    );
  }
}

type DefaultErrorFallbackProps = ErrorBoundaryFallbackProps & {
  title?: string;
  description?: string;
  variant: ErrorBoundaryVariant;
  className?: string;
};

function DefaultErrorFallback({
  error,
  errorInfo,
  reset,
  title,
  description,
  variant,
  className,
}: DefaultErrorFallbackProps) {
  const stack = errorInfo?.componentStack ?? error.stack ?? '';
  const isInline = variant === 'inline';

  return (
    <div
      role="alert"
      className={cn(
        '@container flex w-full items-center justify-center',
        isInline ? 'py-6 px-4' : 'h-full min-h-[240px] flex-1 py-10 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center text-center',
          isInline ? 'gap-3 max-w-md' : 'gap-4 max-w-2xl @md:gap-5 @lg:gap-6',
        )}
      >
        <div
          className={cn(
            'rounded-full bg-accent2/10 text-accent2 flex items-center justify-center',
            isInline
              ? 'h-10 w-10 [&>svg]:h-5 [&>svg]:w-5'
              : 'h-14 w-14 [&>svg]:h-7 [&>svg]:w-7 @md:h-16 @md:w-16 @md:[&>svg]:h-8 @md:[&>svg]:w-8 @lg:h-20 @lg:w-20 @lg:[&>svg]:h-10 @lg:[&>svg]:w-10',
          )}
        >
          <AlertTriangle />
        </div>
        <h3
          className={cn(
            'font-medium text-neutral6',
            isInline ? 'text-ui-md' : 'text-ui-lg @md:text-header-md @lg:text-header-lg',
          )}
        >
          {title ?? 'Something went wrong'}
        </h3>
        <p className={cn('text-neutral3', isInline ? 'text-ui-sm' : 'text-ui-md @lg:text-ui-lg')}>
          {description ?? 'An unexpected error occurred while rendering this part of the page.'}
        </p>
        <p
          className={cn(
            'font-mono text-neutral4 break-words rounded-md bg-surface3 px-3 py-2',
            isInline ? 'text-ui-xs' : 'text-ui-sm',
          )}
        >
          {error.message}
        </p>
        <div className={cn('flex flex-wrap items-center justify-center gap-2', isInline ? 'mt-1' : 'mt-2')}>
          <Button variant="primary" size={isInline ? 'sm' : 'default'} onClick={reset}>
            Try again
          </Button>
          <Button variant="default" size={isInline ? 'sm' : 'default'} onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button
            as="a"
            variant="default"
            size={isInline ? 'sm' : 'default'}
            href="https://github.com/mastra-ai/mastra/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report issue
          </Button>
        </div>
        {stack ? (
          <details className={cn('w-full text-left', isInline ? 'mt-1' : 'mt-2')}>
            <summary className="cursor-pointer text-ui-sm text-neutral3 hover:text-neutral4">
              Show error details
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-surface3 p-3 text-ui-xs text-neutral4 whitespace-pre-wrap break-words">
              {stack}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

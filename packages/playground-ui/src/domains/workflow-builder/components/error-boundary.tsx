import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show a minimal error UI */
  minimal?: boolean;
  /** Custom class name for the error container */
  className?: string;
  /** Context label for error reporting */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { onError, context } = this.props;

    // Log error with context
    console.error(`[ErrorBoundary${context ? `: ${context}` : ''}]`, error, errorInfo);

    // Call custom error handler if provided
    onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, minimal, className, context } = this.props;

    if (hasError) {
      // Custom fallback
      if (fallback) {
        return fallback;
      }

      // Minimal error UI (for inline components like nodes)
      if (minimal) {
        return (
          <div
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg',
              'bg-red-500/10 border border-red-500/30',
              'text-red-400 text-xs',
              className,
            )}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Error{context ? ` in ${context}` : ''}</span>
            <button
              type="button"
              onClick={this.handleReset}
              className="p-1 hover:bg-red-500/20 rounded"
              aria-label="Retry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        );
      }

      // Full error UI
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center p-8',
            'bg-surface2 rounded-lg border border-border1',
            className,
          )}
        >
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>

          <h3 className="text-sm font-semibold text-icon6 mb-1">Something went wrong</h3>

          <p className="text-xs text-icon3 text-center mb-4 max-w-sm">
            {context ? `An error occurred in ${context}.` : 'An unexpected error occurred.'} Try refreshing or contact
            support if the problem persists.
          </p>

          {error && (
            <details className="w-full max-w-md mb-4">
              <summary className="text-xs text-icon4 cursor-pointer hover:text-icon5">Error details</summary>
              <pre className="mt-2 p-2 bg-surface4 rounded text-[10px] text-red-400 overflow-x-auto">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <Button variant="outline" size="md" onClick={this.handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// Specialized Error Boundaries
// ============================================================================

/** Error boundary for node components */
export function NodeErrorBoundary({ children, nodeId }: { children: ReactNode; nodeId: string }) {
  return (
    <ErrorBoundary minimal context={`Node ${nodeId.slice(0, 8)}`} className="w-[274px]">
      {children}
    </ErrorBoundary>
  );
}

/** Error boundary for the canvas */
export function CanvasErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary context="Canvas">{children}</ErrorBoundary>;
}

/** Error boundary for the properties panel */
export function PanelErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary context="Properties Panel">{children}</ErrorBoundary>;
}

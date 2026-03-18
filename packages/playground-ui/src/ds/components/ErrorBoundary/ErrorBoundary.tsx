import * as React from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { EmptyState } from '../EmptyState/EmptyState';

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center" data-testid="error-boundary">
          <EmptyState
            iconSlot={<TriangleAlertIcon className="text-accent-warning h-8 w-8" />}
            titleSlot="Something went wrong"
            descriptionSlot={this.state.error.message}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

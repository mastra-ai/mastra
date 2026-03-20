import { EmptyState } from '@mastra/playground-ui';
import { TriangleAlertIcon } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let description = 'An unexpected error occurred.';
  const normalizeErrorDescription = (error: unknown, fallback: string): string => {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return fallback;
      }
    }

    return fallback;
  };

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'Page not found' : `${error.status} ${error.statusText}`;
    description = error.status === 404 ? 'The page you are looking for does not exist.' : normalizeErrorDescription(error.data, description);
  } else {
    description = normalizeErrorDescription(error, description);
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center" data-testid="route-error">
      <EmptyState
        iconSlot={<TriangleAlertIcon className="text-accent-warning h-8 w-8" />}
        titleSlot={title}
        descriptionSlot={description}
      />
    </div>
  );
}
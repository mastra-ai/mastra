import { EmptyState } from '@mastra/playground-ui';
import { TriangleAlertIcon } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let description = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'Page not found' : `${error.status} ${error.statusText}`;
    description = error.status === 404 ? 'The page you are looking for does not exist.' : (error.data ?? description);
  } else if (error instanceof Error) {
    description = error.message;
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

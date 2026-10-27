import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { useRouteError } from 'react-router';

// Browsers report failed module fetches differently; Vite also rejects the
// import when a page's extracted stylesheet cannot be preloaded.
const pageLoadError =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function RouteErrorPage() {
  const error = useRouteError();
  const failedToLoad = error instanceof Error && pageLoadError.test(error.message);

  return (
    <div role="alert" className="flex min-h-64 flex-1 items-center justify-center">
      <EmptyState
        as="h1"
        tone="error"
        titleSlot={failedToLoad ? 'Could not load this page' : 'Something went wrong'}
        descriptionSlot={
          failedToLoad
            ? 'Check your connection and reload the page. A new version may also be available.'
            : 'Reload the page to try again.'
        }
        actionSlot={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        }
      />
    </div>
  );
}

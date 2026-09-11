import { Switch } from '@mastra/playground-ui/components/Switch';
import { useParams, useSearchParams } from 'react-router';

/**
 * "Show traces" switch for the Chat tab. State lives in the URL (`?variant=advanced`)
 * so it can be rendered from the tab bar without sharing state with the thread page.
 */
export const ThreadTracesToggle = () => {
  const { threadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // "new" is not a stored thread yet, so there is nothing to trace.
  if (!threadId || threadId === 'new') return null;

  const isAdvancedVariant = searchParams.get('variant') === 'advanced';
  const setAdvancedVariant = (enabled: boolean) => {
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        if (enabled) next.set('variant', 'advanced');
        else next.delete('variant');
        return next;
      },
      // Toggling the view is not a navigation: don't stack history entries.
      { replace: true },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Switch id="thread-advanced-view" checked={isAdvancedVariant} onCheckedChange={setAdvancedVariant} />
      <label htmlFor="thread-advanced-view" className="text-ui-sm text-neutral4">
        Show thread traces
      </label>
    </div>
  );
};

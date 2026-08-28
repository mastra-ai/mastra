import { Switch } from '@mastra/playground-ui/components/Switch';
import { useSearchParams } from 'react-router';

export const ENRICHED_PARAM = 'enriched';

export type EnrichedThreadSwitchProps = {
  /** Hidden entirely when the thread has no traces to read. */
  hasTraces: boolean;
};

/**
 * Toggles the chat between the raw conversation and the trace-reconstructed one.
 *
 * The state lives in the URL (`?enriched=true`) so the mode is linkable — that is
 * what lets a trace's "See full thread" land straight in the enriched reading.
 */
export function EnrichedThreadSwitch({ hasTraces }: EnrichedThreadSwitchProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (!hasTraces) return null;

  const checked = searchParams.get(ENRICHED_PARAM) === 'true';

  const onCheckedChange = (next: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set(ENRICHED_PARAM, 'true');
    } else {
      // Drop the param rather than writing `false`, so the default mode has a clean URL.
      params.delete(ENRICHED_PARAM);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="enriched-thread" className="text-neutral3 text-ui-sm">
        Enriched
      </label>
      <Switch id="enriched-thread" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

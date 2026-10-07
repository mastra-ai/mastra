import { Txt } from '@/ds/components/Txt';

/**
 * Fills a chart card's body when its data failed to load. Short and quiet, like the KPI cards:
 * when the API is down every card fails at once, so a long red sentence repeats across the page.
 */
export function ChartCardError() {
  return (
    <div className="flex h-full items-center justify-center">
      <Txt tone="muted">Couldn't load</Txt>
    </div>
  );
}

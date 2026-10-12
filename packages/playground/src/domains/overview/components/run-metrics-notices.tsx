import { Notice } from '@mastra/playground-ui/components/Notice';

export function RunMetricsOffNotice() {
  return (
    <Notice variant="info" title="Run activity is off">
      Turn on observability storage with metrics support to see runs, errors, latency and cost here.
    </Notice>
  );
}

export function RunActivityErrorNotice({ error }: { error: Error }) {
  return (
    <Notice variant="destructive" title="Run activity could not be loaded">
      {error.message}
    </Notice>
  );
}

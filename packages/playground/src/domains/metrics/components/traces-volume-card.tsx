import { TracesVolumeCardView, useTraceVolumeMetrics } from '@mastra/playground-ui';

export function TracesVolumeCard() {
  const { data, isLoading, isError } = useTraceVolumeMetrics();
  return <TracesVolumeCardView data={data} isLoading={isLoading} isError={isError} />;
}

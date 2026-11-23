import { useFetchTraceSpans } from '@mastra/react/hooks/traces';
import { useState } from 'react';
import { downloadJson } from '@/lib/file';
import { toast } from '@/lib/toast';

export function useDownloadTraceJson() {
  const fetchTraceSpans = useFetchTraceSpans();
  const [isPending, setIsPending] = useState(false);

  const download = (traceId: string) => {
    if (isPending) return;
    setIsPending(true);

    const task = fetchTraceSpans(traceId)
      .then(trace => downloadJson(`trace-${traceId}.json`, trace))
      .finally(() => setIsPending(false));

    toast.promise({
      myPromise: task,
      loadingMessage: 'Preparing trace download…',
      successMessage: 'Trace downloaded',
      errorMessage: 'Failed to download trace',
    });
  };

  return { download, isPending };
}

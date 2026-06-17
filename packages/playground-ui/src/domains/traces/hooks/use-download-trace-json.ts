import { useMastraClient } from '@mastra/react';
import { useState } from 'react';
import { downloadJson } from '@/lib/file';
import { toast } from '@/lib/toast';

export function useDownloadTraceJson() {
  const client = useMastraClient();
  const [isPending, setIsPending] = useState(false);

  const download = (traceId: string) => {
    if (isPending) return;
    setIsPending(true);

    // getTrace returns the full payload (heavy input/output), unlike the light spans the panel renders.
    const task = client
      .getTrace(traceId)
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

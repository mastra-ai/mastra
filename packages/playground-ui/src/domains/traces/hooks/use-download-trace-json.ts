import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { traceSpansQueryOptions } from './use-trace-spans';
import { downloadJson } from '@/lib/file';
import { toast } from '@/lib/toast';

export function useDownloadTraceJson() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const download = (traceId: string) => {
    if (isPending) return;
    setIsPending(true);

    // Fetch the full payload into the shared cache so the panel matches the downloaded trace.
    const task = queryClient
      .fetchQuery(traceSpansQueryOptions(client, traceId))
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

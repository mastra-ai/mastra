import { useMastraClient } from '@mastra/react';
import { useState } from 'react';
import { downloadJson } from '@/lib/file';
import { toast } from '@/lib/toast';

/**
 * Downloads a full trace (every span with its complete input, output, metadata, and
 * attributes) as a `trace-<traceId>.json` file.
 *
 * Fetches the full trace on demand via `getTrace` — NOT the lightweight spans the trace
 * panel renders from, which omit the heavy payload fields. The fetch only runs when
 * `download` is called, so opening the panel stays cheap.
 */
export function useDownloadTraceJson() {
  const client = useMastraClient();
  const [isPending, setIsPending] = useState(false);

  const download = (traceId: string) => {
    if (isPending) return;
    setIsPending(true);

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

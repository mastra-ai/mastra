import { MastraClient } from '@mastra/client-js';
import type { BaseLogMessage } from '@mastra/core';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useLogsByRunId = (runId: string) => {
  const [logs, setLogs] = useState<BaseLogMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { transports, isLoading: isLoadingTransports } = useLogTransports();

  // TODO: support multiple transports in dev playground
  const transportId = transports[0];

  const client = new MastraClient({
    baseUrl: '',
  });

  const fetchLogs = async (_runId?: string) => {
    setIsLoading(true);
    try {
      const res = await client.getLogForRun({ transportId, runId: _runId ?? runId });
      setLogs(
        res.map(log => ({
          level: log.level,
          time: log.time,
          pid: log.pid,
          hostname: log.hostname,
          name: log.name,
          runId: log.runId,
          msg: log.msg,
        })),
      );
    } catch (error) {
      setLogs([]);
      console.error('Error fetching logs', error);
      toast.error('Error fetching logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoadingTransports || !transportId) {
      return;
    }
    fetchLogs(runId);
  }, [runId, transportId]);

  return { logs, isLoading, refetchLogs: fetchLogs };
};

export const useLogTransports = () => {
  const [transports, setTransports] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogTransports = async () => {
    const client = new MastraClient({
      baseUrl: '',
    });

    try {
      const res = await client.getLogTransports();
      setTransports(res.transports);
    } catch (error) {
      console.error('Error fetching logs', error);
      toast.error('Error fetching logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogTransports();
  }, []);

  return { transports, isLoading };
};

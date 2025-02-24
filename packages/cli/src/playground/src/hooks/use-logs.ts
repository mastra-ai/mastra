import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MastraClient } from '@mastra/client-js';
import type { BaseLogMessage } from '@mastra/core';

export const useLogs = () => {
  const [logs, setLogs] = useState<BaseLogMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const res = await client.getLogs({ transportId: 'upstash' });
        setLogs(res);
      } catch (error) {
        setLogs([]);
        console.error('Error fetching logs', error);
        toast.error('Error fetching logs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return { logs, isLoading };
};

export const useLogsByRunId = (runId: string) => {
  const [logs, setLogs] = useState<BaseLogMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  const fetchLogs = async (_runId?: string) => {
    setIsLoading(true);
    try {
      const res = await client.getLogForRun({ transportId: 'upstash', runId: _runId ?? runId });
      setLogs(res.map((log) => ({ level: log.level, time: log.time, pid: log.pid, hostname: log.hostname, name: log.name, runId: log.runId, msg: log.msg })));
    } catch (error) {
      setLogs([]);
      console.error('Error fetching logs', error);
      toast.error('Error fetching logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(runId);
  }, [runId]);

  return { logs, isLoading, refetchLogs: fetchLogs };
};

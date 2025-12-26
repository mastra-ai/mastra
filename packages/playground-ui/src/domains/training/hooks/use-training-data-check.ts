'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseTrainingDataCheckOptions {
  baseUrl?: string;
  agentId?: string;
  agentName?: string;
}

interface TrainingDataCheckResult {
  hasData: boolean;
  traceCount: number;
  message?: string;
}

interface UseTrainingDataCheckReturn {
  hasData: boolean;
  traceCount: number;
  message?: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to check if training data (traces) is available for an agent.
 */
export function useTrainingDataCheck(options: UseTrainingDataCheckOptions = {}): UseTrainingDataCheckReturn {
  const { baseUrl = '', agentId, agentName } = options;

  const [result, setResult] = useState<TrainingDataCheckResult>({
    hasData: false,
    traceCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!agentId && !agentName) {
      setResult({ hasData: false, traceCount: 0, message: 'No agent selected' });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (agentId) params.append('agentId', agentId);
      if (agentName) params.append('agentName', agentName);

      const response = await fetch(`${baseUrl}/api/training/check-data?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to check training data: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check training data');
      setResult({ hasData: false, traceCount: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, agentId, agentName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    hasData: result.hasData,
    traceCount: result.traceCount,
    message: result.message,
    isLoading,
    error,
    refresh,
  };
}

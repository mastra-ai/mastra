'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TrainingJob, TrainingConfig } from '../types';

interface UseTrainingJobsOptions {
  baseUrl?: string;
  agentId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTrainingJobsReturn {
  jobs: TrainingJob[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startJob: (agentId: string, config: TrainingConfig) => Promise<TrainingJob>;
  cancelJob: (jobId: string) => Promise<void>;
  getJob: (jobId: string) => Promise<TrainingJob>;
}

/**
 * Hook for managing training jobs.
 */
export function useTrainingJobs(options: UseTrainingJobsOptions = {}): UseTrainingJobsReturn {
  const { baseUrl = '', agentId, autoRefresh = false, refreshInterval = 30000 } = options;

  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (agentId) {
        params.append('agentId', agentId);
      }

      const response = await fetch(`${baseUrl}/api/training/jobs?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }

      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch training jobs');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, agentId]);

  const startJob = useCallback(
    async (targetAgentId: string, config: TrainingConfig): Promise<TrainingJob> => {
      const response = await fetch(`${baseUrl}/api/training/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetAgentId, config }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to start training job');
      }

      const job = await response.json();
      // Add the new job to local state immediately (no need to refetch all)
      setJobs(prev => [job, ...prev]);
      return job;
    },
    [baseUrl],
  );

  const cancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      const response = await fetch(`${baseUrl}/api/training/jobs/${jobId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Failed to cancel training job');
      }

      await refresh();
    },
    [baseUrl, refresh],
  );

  const getJob = useCallback(
    async (jobId: string): Promise<TrainingJob> => {
      const response = await fetch(`${baseUrl}/api/training/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.statusText}`);
      }
      return response.json();
    },
    [baseUrl],
  );

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    jobs,
    isLoading,
    error,
    refresh,
    startJob,
    cancelJob,
    getJob,
  };
}

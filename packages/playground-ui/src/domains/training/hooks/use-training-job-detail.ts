'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TrainingJob, TrainingJobEvent, TrainingJobCheckpoint } from '../types';

interface UseTrainingJobDetailOptions {
  baseUrl?: string;
  jobId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTrainingJobDetailReturn {
  job: TrainingJob | null;
  events: TrainingJobEvent[];
  checkpoints: TrainingJobCheckpoint[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * Hook for fetching training job details, events, and checkpoints.
 */
export function useTrainingJobDetail(options: UseTrainingJobDetailOptions): UseTrainingJobDetailReturn {
  const { baseUrl = '', jobId, autoRefresh = false, refreshInterval = 10000 } = options;

  const [job, setJob] = useState<TrainingJob | null>(null);
  const [events, setEvents] = useState<TrainingJobEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<TrainingJobCheckpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch job, events, and checkpoints in parallel
      const [jobRes, eventsRes, checkpointsRes] = await Promise.all([
        fetch(`${baseUrl}/api/training/jobs/${jobId}`),
        fetch(`${baseUrl}/api/training/jobs/${jobId}/events`),
        fetch(`${baseUrl}/api/training/jobs/${jobId}/checkpoints`),
      ]);

      if (!jobRes.ok) {
        throw new Error(`Failed to fetch job: ${jobRes.statusText}`);
      }

      const jobData = await jobRes.json();
      setJob(jobData);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }

      if (checkpointsRes.ok) {
        const checkpointsData = await checkpointsRes.json();
        setCheckpoints(checkpointsData.checkpoints || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job details');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, jobId]);

  const cancel = useCallback(async () => {
    const response = await fetch(`${baseUrl}/api/training/jobs/${jobId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to cancel job');
    }

    await refresh();
  }, [baseUrl, jobId, refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto refresh for running jobs
  useEffect(() => {
    if (!autoRefresh) return;
    if (job && (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled')) {
      return; // Don't refresh completed jobs
    }

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh, job]);

  return {
    job,
    events,
    checkpoints,
    isLoading,
    error,
    refresh,
    cancel,
  };
}

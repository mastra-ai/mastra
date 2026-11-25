export type EnvironmentBuildState = 'pending' | 'building' | 'ready' | 'failed' | 'unknown';

export interface EnvironmentLastBuild {
  buildId: string;
  attemptedAt: string | null;
}

export interface EnvironmentBuild {
  buildId: string;
  status: EnvironmentBuildState;
  templateId?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Log lines, as the provider streams them. */
  logs?: string[];
}

export const ENVIRONMENT_BUILD_STATUS: Record<
  EnvironmentBuildState,
  { label: string; variant: 'neutral' | 'success' | 'destructive' | 'warning' | 'info' }
> = {
  pending: { label: 'Pending', variant: 'info' },
  building: { label: 'Building', variant: 'info' },
  ready: { label: 'Ready', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'warning' },
};

export function formatEnvironmentBuildTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

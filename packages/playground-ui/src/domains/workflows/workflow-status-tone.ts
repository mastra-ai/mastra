export type WorkflowStatusTone = 'success' | 'destructive' | 'info' | 'warning' | 'neutral';

const toneByStatus: Record<string, WorkflowStatusTone> = {
  success: 'success',
  failed: 'destructive',
  running: 'info',
  suspended: 'warning',
  waiting: 'warning',
  paused: 'warning',
};

export function workflowStatusTone(status: string | undefined): WorkflowStatusTone {
  const tone = status && Object.hasOwn(toneByStatus, status) ? toneByStatus[status] : undefined;
  return tone ?? 'neutral';
}

export const workflowStatusToneText = {
  success: 'text-success-indicator',
  destructive: 'text-destructive-indicator',
  info: 'text-info-indicator',
  warning: 'text-warning-indicator',
  neutral: 'text-muted-foreground',
} satisfies Record<WorkflowStatusTone, string>;

export const workflowStatusToneBar = {
  success: 'bg-success-indicator',
  destructive: 'bg-destructive-indicator',
  info: 'bg-info-indicator',
  warning: 'bg-warning-indicator',
  neutral: 'bg-muted-foreground/40',
} satisfies Record<WorkflowStatusTone, string>;

import { CircleX } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { RunStatus } from '../runs/runBars';

interface RunStatusPresentation {
  label: string;
  text: string;
  statusLayer?: string;
  statusAccent?: string;
  edge?: string;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export const RUN_STATUS_PRESENTATION: Record<RunStatus, RunStatusPresentation> = {
  running: {
    label: 'Running',
    text: 'text-info-subtle-foreground',
    statusLayer: 'bg-info-subtle',
    statusAccent: 'text-info-indicator',
    edge: 'border-r-2 border-info-indicator',
  },
  'needs-you': {
    label: 'Needs you',
    text: 'text-warning-subtle-foreground',
    statusLayer: 'bg-warning-subtle',
    statusAccent: 'text-warning-indicator',
    edge: 'border-r-2 border-warning-indicator',
  },
  complete: { label: 'Complete', text: 'text-foreground' },
  stopped: {
    label: 'Stopped',
    text: 'text-muted-foreground',
    statusLayer: 'bg-fill',
    statusAccent: 'text-border-strong',
  },
  failed: {
    label: 'Failed',
    text: 'text-destructive-subtle-foreground',
    statusLayer: 'bg-destructive-subtle',
    statusAccent: 'text-destructive-indicator',
    Icon: CircleX,
  },
  unaccounted: {
    label: 'No end recorded',
    text: 'text-muted-foreground',
    statusLayer: 'bg-fill mask-r-from-60%',
    statusAccent: 'text-border-strong',
  },
};

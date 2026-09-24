import { Info, Layers } from 'lucide-react';
import { ActivityItem } from '../activity';
import { messagePreview, messagePreviewShowsAll } from './message-preview';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

export interface SignalActivityProps {
  kind: 'state' | 'reactive' | 'reminder';
  label: string;
  message: string;
  /** Names the line instead of a preview of the message, e.g. the file a reminder injects. */
  detail?: string;
  mode?: string;
  defaultOpen?: boolean;
}

const signalKinds = {
  state: {
    icon: <Layers className="text-purple-400" aria-hidden />,
    body: { variant: 'caption' },
  },
  reactive: {
    icon: <Info aria-hidden />,
    body: { variant: 'caption' },
  },
  reminder: {
    icon: <Info className="text-accent3" aria-hidden />,
    body: { variant: 'meta', font: 'mono' },
  },
} as const;

export function SignalActivity({ kind, label, message, detail, mode, defaultOpen }: SignalActivityProps) {
  const { icon, body } = signalKinds[kind];
  const lineHoldsMessage = detail === undefined && messagePreviewShowsAll(message);

  return (
    <ActivityItem
      icon={icon}
      label={label}
      detail={detail ?? messagePreview(message)}
      badges={mode ? <Badge size="xs">{mode}</Badge> : undefined}
      defaultOpen={defaultOpen}
      data-signal-kind={kind}
      aria-label={`Signal: ${label}`}
    >
      {message && !lineHoldsMessage && (
        <Txt {...body} className="break-words whitespace-pre-wrap">
          {message}
        </Txt>
      )}
    </ActivityItem>
  );
}

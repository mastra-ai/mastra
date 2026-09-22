import { Database, FileText, Info, Layers, Radio } from 'lucide-react';
import { ChatEvent } from './chat-event';
import { chatEventPreview, chatEventPreviewShowsAll } from './chat-event-preview';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

export interface ChatSignalProps {
  kind: 'state' | 'reactive' | 'reminder';
  label: string;
  message: string;
  detail?: string;
  mode?: string;
  variant?: 'row' | 'card';
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const signalKinds = {
  state: {
    rowIcon: <Layers size={13} className="text-purple-400" aria-hidden />,
    cardIcon: <Database className="size-4" aria-hidden />,
    body: { variant: 'caption' },
  },
  reactive: {
    rowIcon: <Info size={13} className="text-muted-foreground" aria-hidden />,
    cardIcon: <Radio className="size-4" aria-hidden />,
    body: { variant: 'caption' },
  },
  reminder: {
    rowIcon: <Info size={13} className="text-accent3" aria-hidden />,
    cardIcon: <FileText className="size-4" aria-hidden />,
    body: { variant: 'meta', font: 'mono' },
  },
} as const;

export function ChatSignal({
  kind,
  label,
  message,
  detail,
  mode,
  variant = 'row',
  collapsible,
  defaultOpen,
}: ChatSignalProps) {
  const { rowIcon, cardIcon, body } = signalKinds[kind];
  const isCard = variant === 'card';
  const preview = chatEventPreview(message);
  const bodyRepeatsPreview = !isCard && chatEventPreviewShowsAll(message);

  return (
    <ChatEvent
      density={isCard ? 'card' : 'row'}
      icon={isCard ? cardIcon : rowIcon}
      label={label}
      detail={isCard ? detail : preview}
      badges={isCard && mode ? <Badge size="sm">{mode}</Badge> : undefined}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      data-signal-kind={kind}
      aria-label={`Signal: ${label}`}
    >
      {message && !bodyRepeatsPreview && (
        <Txt {...body} className="break-words whitespace-pre-wrap">
          {message}
        </Txt>
      )}
    </ChatEvent>
  );
}

import { Database, Info, Layers, Radio } from 'lucide-react';
import { ChatEvent } from './chat-event';
import { chatEventPreview } from './chat-event-preview';
import { Txt } from '@/ds/components/Txt';

export interface ChatSignalProps {
  kind: 'state' | 'reactive' | 'reminder';
  label: string;
  message: string;
  mode?: string;
  variant?: 'row' | 'card';
  defaultOpen?: boolean;
}

const rowIcons = {
  state: <Layers size={13} className="text-purple-400" aria-hidden />,
  reminder: <Info size={13} className="text-accent3" aria-hidden />,
  reactive: <Info size={13} className="text-muted-foreground" aria-hidden />,
};

export function ChatSignal({ kind, label, message, mode, variant = 'row', defaultOpen }: ChatSignalProps) {
  if (variant === 'card') {
    const Icon = kind === 'state' ? Database : Radio;
    return (
      <div className="my-2 max-w-[80%] rounded-lg border border-border bg-background px-4 py-3 text-foreground">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-column text-foreground">{label}</p>
              {mode && (
                <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-caption leading-none text-muted-foreground">
                  {mode}
                </span>
              )}
            </div>
            {message && <p className="mt-2 text-caption break-words whitespace-pre-wrap">{message}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatEvent
      label={label}
      detail={chatEventPreview(message)}
      icon={rowIcons[kind]}
      defaultOpen={defaultOpen}
      data-signal-kind={kind}
      aria-label={`Signal: ${label}`}
    >
      {message && (
        <Txt variant="caption" className="break-words whitespace-pre-wrap">
          {message}
        </Txt>
      )}
    </ChatEvent>
  );
}

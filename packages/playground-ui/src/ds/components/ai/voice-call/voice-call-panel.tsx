import type { VoiceCallStatus } from './voice-call-button';
import { cn } from '@/lib/utils';

export type VoiceAgentState = 'initializing' | 'listening' | 'thinking' | 'speaking';
export interface VoiceCaptionSegment {
  id: string;
  role: 'user' | 'agent';
  text: string;
  final: boolean;
}

const AGENT_STATE_LABELS: Record<VoiceAgentState, string> = {
  initializing: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export interface VoiceCallPanelProps {
  status: VoiceCallStatus;
  agentState: VoiceAgentState;
  captions: VoiceCaptionSegment[];
}

const lastSegmentByRole = (segments: VoiceCaptionSegment[], role: 'user' | 'agent') => {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]?.role === role) return segments[i];
  }
  return undefined;
};

export const VoiceCallPanel = ({ status, agentState, captions }: VoiceCallPanelProps) => {
  if (status === 'idle') return null;

  const lastUserCaption = lastSegmentByRole(captions, 'user');
  const lastAgentCaption = lastSegmentByRole(captions, 'agent');
  const stateLabel = status === 'connecting' ? 'Connecting…' : AGENT_STATE_LABELS[agentState];

  return (
    <div
      data-testid="voice-call-panel"
      className="border-border2/40 bg-surface3 mx-auto mb-2 w-full max-w-3xl rounded-[16px] border px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'connecting' && 'bg-neutral3',
            status === 'active' && agentState === 'speaking' && 'bg-accent1 motion-safe:animate-pulse',
            status === 'active' && agentState !== 'speaking' && 'bg-accent1',
          )}
        />
        <span className="text-ui-sm text-neutral4">{stateLabel}</span>
      </div>
      {lastUserCaption && (
        <p className="text-ui-sm text-neutral3 mt-2 truncate" data-testid="voice-caption-user">
          {lastUserCaption.text}
        </p>
      )}
      {lastAgentCaption && (
        <p className="text-ui-sm text-neutral6 mt-1" data-testid="voice-caption-agent">
          {lastAgentCaption.text}
        </p>
      )}
    </div>
  );
};

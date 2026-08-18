import { cn } from '@mastra/playground-ui/utils/cn';
import type { VoiceAgentState, VoiceCallControls, VoiceCaptionSegment } from '../types';

const AGENT_STATE_LABELS: Record<VoiceAgentState, string> = {
  initializing: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export interface VoiceCallPanelProps {
  voiceCall: VoiceCallControls;
}

const lastSegmentByRole = (segments: VoiceCaptionSegment[], role: 'user' | 'agent') => {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]?.role === role) return segments[i];
  }
  return undefined;
};

export const VoiceCallPanel = ({ voiceCall }: VoiceCallPanelProps) => {
  if (voiceCall.status === 'idle') return null;

  const lastUserCaption = lastSegmentByRole(voiceCall.captions, 'user');
  const lastAgentCaption = lastSegmentByRole(voiceCall.captions, 'agent');
  const stateLabel = voiceCall.status === 'connecting' ? 'Connecting…' : AGENT_STATE_LABELS[voiceCall.agentState];

  return (
    <div
      data-testid="voice-call-panel"
      className="border-border2/40 bg-surface3 mx-auto mb-2 w-full max-w-3xl rounded-[16px] border px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            voiceCall.status === 'connecting' && 'bg-neutral3',
            voiceCall.status === 'active' && voiceCall.agentState === 'speaking' && 'bg-accent1 animate-pulse',
            voiceCall.status === 'active' && voiceCall.agentState !== 'speaking' && 'bg-green-500',
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

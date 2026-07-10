import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Brain, Target } from 'lucide-react';

import { useChatModels } from '../context/useChatModels';
import { useChatModes } from '../context/useChatModes';
import { useChatTranscript } from '../context/useChatTranscript';

const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';
const statusBudget = 'inline-flex items-baseline whitespace-nowrap text-icon3 tabular-nums';
const slLabel = 'mr-1 text-icon2';
const slBuffer = 'italic text-icon2';

function fmtTokensValue(n: number): string {
  if (n <= 0) return '0';
  const s = (n / 1000).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function fmtTokensThreshold(n: number): string {
  const s = (n / 1000).toFixed(1);
  return `${s.endsWith('.0') ? s.slice(0, -2) : s}k`;
}

function pctClass(percent: number): string {
  if (percent >= 90) return 'text-error';
  if (percent >= 75) return 'text-warning1';
  return 'text-icon3';
}

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

export function StatusLine() {
  const { transcript } = useChatTranscript();
  const { activeModelId } = useChatModels();
  const { modes, activeModeId, setMode } = useChatModes();
  const om = transcript.omProgress;
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;
  const selectedModeId = activeModeId ?? modes[0]?.id;

  return (
    <div
      aria-label="Session status line"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-ui-sm text-icon3"
    >
      {modes.length > 0 && (
        <div role="group" aria-label="Session mode" className="shrink-0">
          <ButtonsGroup spacing="close">
            {modes.map(m => (
              <Button
                key={m.id}
                variant={selectedModeId === m.id ? 'primary' : 'ghost'}
                size="sm"
                aria-pressed={selectedModeId === m.id}
                onClick={() => {
                  void setMode(m.id);
                }}
              >
                {m.name ?? m.id}
              </Button>
            ))}
          </ButtonsGroup>
        </div>
      )}

      <span className="text-icon3 tabular-nums">{activeModelId ? lastSegment(activeModelId) : 'no model'}</span>

      {showMsg && (
        <span
          className={`${statusBudget} ${pctClass(om.thresholdPercent)}`}
          title="Message window until next observation"
        >
          <span className={slLabel}>msg</span> {fmtTokensValue(om.pendingTokens)}/{fmtTokensThreshold(om.threshold)}
          {om.projectedMessageRemoval > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om.projectedMessageRemoval)}</span>
          )}
        </span>
      )}
      {showMem && (
        <span
          className={`${statusBudget} ${pctClass(om.reflectionThresholdPercent)}`}
          title="Observations accumulated until next reflection"
        >
          <span className={slLabel}>mem</span> {fmtTokensValue(om.observationTokens)}/
          {fmtTokensThreshold(om.reflectionThreshold)}
          {om.projectedReflectionSavings > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om.projectedReflectionSavings)}</span>
          )}
        </span>
      )}

      {transcript.omPhase && transcript.omPhase !== 'idle' && (
        <span className={statusItem}>
          <Brain size={13} /> {transcript.omPhase}
        </span>
      )}
      {(transcript.tokensPerSec ?? 0) > 0 && <span className={statusItem}>{transcript.tokensPerSec} tok/s</span>}
      {(transcript.followUpCount ?? 0) > 0 && <span className={statusItem}>{transcript.followUpCount} queued</span>}
      {transcript.goal && transcript.goal.status !== 'done' && (
        <span className="inline-flex items-center gap-1 text-accent2 [&_svg]:text-accent2">
          <Target size={13} /> {transcript.goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
        </span>
      )}

      <span className="flex-1" />
    </div>
  );
}

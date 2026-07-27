import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Circle, Hammer, Map, Zap } from 'lucide-react';

import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useIsRouteThreadSwitching } from '../../hooks/useIsRouteThreadSwitching';
import { getModeColorClass } from '../mode-colors';

function ModeIcon({ modeId }: { modeId: string }) {
  const iconProps = { size: 12, 'aria-hidden': true };

  switch (modeId.toLowerCase()) {
    case 'build':
      return <Hammer {...iconProps} />;
    case 'plan':
      return <Map {...iconProps} />;
    case 'fast':
      return <Zap {...iconProps} />;
    default:
      return <Circle {...iconProps} />;
  }
}

function ModeLabel({ modeId, name }: { modeId: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ModeIcon modeId={modeId} />
      <span>{name}</span>
    </span>
  );
}

/**
 * Session mode selector; switches modes through the agent controller. Only
 * shown for personal (user) sessions — factory sessions are driven by the
 * factory's own run prompts, so mode switching is hidden there.
 */
export function ModesSelection() {
  const { kind } = useChatSessionContext();
  const { modes, activeModeId, isSwitchingMode, setMode } = useChatModes();
  const isSwitchingThread = useIsRouteThreadSwitching();
  const selectedModeId = activeModeId ?? modes[0]?.id;
  const selectedMode = modes.find(mode => mode.id === selectedModeId) ?? modes[0];

  if (kind === 'factory') return null;
  // Never label a new route with the previously-bound thread's mode, and never
  // let a mode mutation target that thread mid-switch.
  if (isSwitchingThread) {
    return <Skeleton aria-label="Loading mode" className="h-3.5 w-16" />;
  }
  if (!selectedMode) return null;

  return (
    <Select
      value={selectedModeId}
      disabled={isSwitchingMode}
      onValueChange={modeId => {
        if (isSwitchingMode) return;
        void setMode(modeId).catch(() => {});
      }}
    >
      <SelectTrigger
        variant="ghost"
        size="xs"
        aria-label="Session mode"
        aria-busy={isSwitchingMode}
        className={cn('chat-mode-text w-auto', getModeColorClass(selectedMode.id))}
      >
        <ModeLabel modeId={selectedMode.id} name={selectedMode.name ?? selectedMode.id} />
      </SelectTrigger>
      <SelectContent>
        {modes.map(mode => (
          <SelectItem key={mode.id} value={mode.id}>
            <ModeLabel modeId={mode.id} name={mode.name ?? mode.id} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

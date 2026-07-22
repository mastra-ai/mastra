import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Circle, Hammer, Map, Zap } from 'lucide-react';
import { useState } from 'react';

import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { getModeTextColorClass } from '../mode-colors';

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
  const { modes, activeModeId, setMode } = useChatModes();
  const [pendingModeId, setPendingModeId] = useState<string>();
  const selectedModeId = pendingModeId ?? activeModeId ?? modes[0]?.id;
  const selectedMode = modes.find(mode => mode.id === selectedModeId) ?? modes[0];

  if (kind === 'factory') return null;
  if (!selectedMode) return null;

  return (
    <Select
      value={selectedModeId}
      disabled={Boolean(pendingModeId)}
      onValueChange={modeId => {
        if (pendingModeId) return;
        setPendingModeId(modeId);
        void setMode(modeId).then(
          () => setPendingModeId(undefined),
          () => setPendingModeId(undefined),
        );
      }}
    >
      <SelectTrigger
        variant="ghost"
        size="xs"
        aria-label="Session mode"
        aria-busy={Boolean(pendingModeId)}
        className={cn('w-auto', getModeTextColorClass(selectedMode.id))}
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

import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { ComposerToneLabel } from '@mastra/playground-ui/components/Composer';
import { Circle, Hammer, Map, Zap } from 'lucide-react';
import { useState } from 'react';

import { getComposerTone } from '../composer-tone';
import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';

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

export function ModesSelection() {
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { modes, activeModeId, setMode } = useChatModes();
  const [pendingModeId, setPendingModeId] = useState<string>();
  const selectedModeId = pendingModeId ?? activeModeId ?? modes[0]?.id;
  const selectedMode = modes.find(mode => mode.id === selectedModeId) ?? modes[0];

  if (kind === 'factory') return null;
  if (!sessionEnabled && !draftSessionId) return null;
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
        className="w-auto"
      >
        <ComposerToneLabel tone={getComposerTone(selectedMode.id)}>
          <ModeLabel modeId={selectedMode.id} name={selectedMode.name ?? selectedMode.id} />
        </ComposerToneLabel>
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

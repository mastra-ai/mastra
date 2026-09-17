import { ModeIcon } from './ModeIcon';
import { ComposerModeSelect } from '@mastra/playground-ui/components/Composer';
import { useState } from 'react';

import { getComposerTone } from '../composer-tone';
import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';

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
    <ComposerModeSelect
      modes={modes.map(mode => ({
        id: mode.id,
        name: mode.name ?? mode.id,
        tone: getComposerTone(mode.id),
        icon: <ModeIcon modeId={mode.id} />,
      }))}
      value={selectedMode.id}
      busy={Boolean(pendingModeId)}
      onValueChange={modeId => {
        if (pendingModeId) return;
        setPendingModeId(modeId);
        void setMode(modeId).then(
          () => setPendingModeId(undefined),
          () => setPendingModeId(undefined),
        );
      }}
    />
  );
}

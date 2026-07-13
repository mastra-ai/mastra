import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';

import { useChatModes } from '../../context/useChatModes';

/** Session mode buttons; switches modes through the agent controller. */
export function ModesSelection() {
  const { modes, activeModeId, setMode } = useChatModes();
  const selectedModeId = activeModeId ?? modes[0]?.id;

  if (modes.length === 0) return null;

  return (
    <div role="group" aria-label="Session mode" className="shrink-0">
      <ButtonsGroup spacing="close">
        {modes.map(m => (
          <Button
            key={m.id}
            variant={selectedModeId === m.id ? 'primary' : 'ghost'}
            size="sm"
            aria-pressed={selectedModeId === m.id}
            onClick={() => void setMode(m.id)}
          >
            {m.name ?? m.id}
          </Button>
        ))}
      </ButtonsGroup>
    </div>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';

import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { getModeColor, getModeForegroundColor } from '../mode-colors';

/**
 * Session mode buttons; switches modes through the agent controller. Only
 * shown for personal (user) sessions — factory sessions are driven by the
 * factory's own run prompts, so mode switching is hidden there.
 */
export function ModesSelection() {
  const { kind } = useChatSessionContext();
  const { modes, activeModeId, setMode } = useChatModes();
  const selectedModeId = activeModeId ?? modes[0]?.id;

  if (kind === 'factory') return null;
  if (modes.length === 0) return null;

  return (
    <div role="group" aria-label="Session mode" className="shrink-0">
      <ButtonsGroup spacing="close">
        {modes.map(m => {
          const selected = selectedModeId === m.id;
          const modeColor = getModeColor(m.id);
          const modeForegroundColor = getModeForegroundColor(m.id);

          return (
            <Button
              key={m.id}
              variant="outline"
              size="sm"
              style={
                selected && modeColor && modeForegroundColor
                  ? { backgroundColor: modeColor, color: modeForegroundColor }
                  : undefined
              }
              aria-pressed={selected}
              onClick={() => void setMode(m.id)}
            >
              {m.name ?? m.id}
            </Button>
          );
        })}
      </ButtonsGroup>
    </div>
  );
}

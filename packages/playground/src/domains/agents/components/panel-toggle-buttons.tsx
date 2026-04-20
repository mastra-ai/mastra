import { IconButton } from '@mastra/playground-ui';
import { Info, Brain } from 'lucide-react';
import { usePanelVisibility } from '../context/use-panel-visibility';

interface PanelToggleButtonsProps {
  hasMemory: boolean;
}

export function PanelToggleButtons({ hasMemory }: PanelToggleButtonsProps) {
  const { visibility, toggleOverview, toggleMemory } = usePanelVisibility();

  return (
    <>
      <IconButton
        variant={visibility.overview ? 'primary' : 'ghost'}
        size="sm"
        tooltip={visibility.overview ? 'Hide Overview' : 'Show Overview'}
        onClick={toggleOverview}
      >
        <Info />
      </IconButton>
      {hasMemory && (
        <IconButton
          variant={visibility.memory ? 'primary' : 'ghost'}
          size="sm"
          tooltip={visibility.memory ? 'Hide Memory' : 'Show Memory'}
          onClick={toggleMemory}
        >
          <Brain />
        </IconButton>
      )}
    </>
  );
}

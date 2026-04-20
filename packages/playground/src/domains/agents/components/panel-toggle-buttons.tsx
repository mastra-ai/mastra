import { IconButton } from '@mastra/playground-ui';
import { Info, Brain } from 'lucide-react';
import { useCallback } from 'react';
import { usePanelSizing } from '../context/use-panel-sizing';
import { usePanelVisibility } from '../context/use-panel-visibility';

interface PanelToggleButtonsProps {
  hasMemory: boolean;
}

export function PanelToggleButtons({ hasMemory }: PanelToggleButtonsProps) {
  const { visibility, toggleOverview, toggleMemory } = usePanelVisibility();
  const { adjustSizeForSecondCard } = usePanelSizing();

  const handleToggleOverview = useCallback(() => {
    const turningOn = !visibility.overview;
    const otherActive = visibility.memory && hasMemory;
    if (turningOn && otherActive) adjustSizeForSecondCard();
    toggleOverview();
  }, [visibility.overview, visibility.memory, hasMemory, adjustSizeForSecondCard, toggleOverview]);

  const handleToggleMemory = useCallback(() => {
    const turningOn = !visibility.memory;
    if (turningOn && visibility.overview) adjustSizeForSecondCard();
    toggleMemory();
  }, [visibility.memory, visibility.overview, adjustSizeForSecondCard, toggleMemory]);

  return (
    <>
      <IconButton
        variant="default"
        tooltip={visibility.overview ? 'Hide Overview' : 'Show Overview'}
        onClick={handleToggleOverview}
      >
        <Info />
      </IconButton>
      {hasMemory && (
        <IconButton
          variant="default"
          tooltip={visibility.memory ? 'Hide Memory' : 'Show Memory'}
          onClick={handleToggleMemory}
        >
          <Brain />
        </IconButton>
      )}
    </>
  );
}

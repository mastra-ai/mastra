import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { IconLayoutColumn } from '@mastra/playground-ui/icons/central/IconLayoutColumn';
import { IconListBullets } from '@mastra/playground-ui/icons/central/IconListBullets';

export type AgentsView = 'compact' | 'list';

export interface AgentsViewToggleProps {
  view: AgentsView;
  onViewChange: (view: AgentsView) => void;
}

export function AgentsViewToggle({ view, onViewChange }: AgentsViewToggleProps) {
  return (
    <ButtonsGroup aria-label="Agents view">
      <Button
        type="button"
        variant={view === 'list' ? 'default' : 'ghost'}
        size="icon-md"
        tooltip="List view"
        aria-pressed={view === 'list'}
        onClick={() => onViewChange('list')}
      >
        <IconListBullets />
      </Button>
      <Button
        type="button"
        variant={view === 'compact' ? 'default' : 'ghost'}
        size="icon-md"
        tooltip="Compact view"
        aria-pressed={view === 'compact'}
        onClick={() => onViewChange('compact')}
      >
        <IconLayoutColumn />
      </Button>
    </ButtonsGroup>
  );
}

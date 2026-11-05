import { Columns2, List } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

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
        <List />
      </Button>
      <Button
        type="button"
        variant={view === 'compact' ? 'default' : 'ghost'}
        size="icon-md"
        tooltip="Compact view"
        aria-pressed={view === 'compact'}
        onClick={() => onViewChange('compact')}
      >
        <Columns2 />
      </Button>
    </ButtonsGroup>
  );
}

import { Button } from '../../../ds/components/Button';
import { Txt } from '../../../ds/components/Txt';
import { IconFork } from '../../../ds/icons/central/IconFork';

export interface CloneThreadControlProps {
  isCloning?: boolean;
  disabled?: boolean;
  onClone: () => void;
}

export function CloneThreadControl({ isCloning = false, disabled = false, onClone }: CloneThreadControlProps) {
  return (
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Txt as="h3" variant="subheading" tone="ink">
            Clone Thread
          </Txt>
          <Txt variant="caption" tone="muted" className="mt-1">
            Create a copy of this conversation
          </Txt>
        </div>
        <Button onClick={onClone} disabled={disabled} icon={<IconFork />} loading={isCloning}>
          Clone
        </Button>
      </div>
    </div>
  );
}

import { Combobox } from '@/ds/components/Combobox';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { Icon } from '@/ds/icons/Icon';

export type ScoreEntityOption = { value: string; label: string; type: 'AGENT' | 'WORKFLOW' | 'ALL' };

type ScoresToolsProps = {
  selectedEntity?: ScoreEntityOption;
  entityOptions?: ScoreEntityOption[];
  onEntityChange: (val: ScoreEntityOption) => void;
  onReset?: () => void;
  isLoading?: boolean;
};

export function ScoresTools({ onEntityChange, onReset, selectedEntity, entityOptions, isLoading }: ScoresToolsProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-8 gap-y-4')}>
      <div className="flex gap-2 items-center">
        <label className="text-ui-sm text-neutral3 shrink-0">Filter by Entity</label>
        <Combobox
          placeholder="Select..."
          options={entityOptions || []}
          onValueChange={val => {
            const entity = entityOptions?.find(entity => entity.value === val);
            if (entity) {
              onEntityChange(entity);
            }
          }}
          value={selectedEntity?.value || ''}
          className="min-w-[20rem]"
          disabled={isLoading}
          size="lg"
        />
      </div>

      <Button variant="light" size="lg" className="min-w-32" onClick={onReset} disabled={isLoading}>
        Reset
        <Icon>
          <XIcon />
        </Icon>
      </Button>
    </div>
  );
}

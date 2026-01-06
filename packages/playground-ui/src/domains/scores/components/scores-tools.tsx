import { SelectField } from '@/components/ui/elements';
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
    <div className={cn('flex flex-wrap gap-x-[2rem] gap-y-[1rem]')}>
      <SelectField
        label="Filter by Entity"
        name={'select-entity'}
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
      />

      <Button variant="light" size="lg" className="min-w-32" onClick={onReset} disabled={isLoading}>
        Reset
        <Icon>
          <XIcon />
        </Icon>
      </Button>
    </div>
  );
}

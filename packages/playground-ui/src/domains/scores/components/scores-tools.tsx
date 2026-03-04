import { SelectField } from '@/ds/components/FormFields';
import { Button } from '@/ds/components/Button/Button';
import { XIcon } from 'lucide-react';
import { Icon } from '@/ds/icons/Icon';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

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
    <ButtonsGroup>
      <SelectField
        label="Filter by Entity"
        labelIsHidden={true}
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
        className="min-w-56"
        disabled={isLoading}
      />

      {selectedEntity && selectedEntity.value !== 'all' && (
        <Button onClick={onReset} disabled={isLoading}>
          Reset
          <Icon>
            <XIcon />
          </Icon>
        </Button>
      )}
    </ButtonsGroup>
  );
}

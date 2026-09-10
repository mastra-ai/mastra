import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { XIcon } from 'lucide-react';

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
      <SelectFieldBlock
        label="Filter by Entity"
        labelIsHidden={true}
        name="select-entity"
        placeholder="Select..."
        options={entityOptions || []}
        onValueChange={(val: string) => {
          const entity = entityOptions?.find(entity => entity.value === val);
          if (entity) {
            onEntityChange(entity);
          }
        }}
        value={selectedEntity?.value || ''}
        className="whitespace-nowrap"
        disabled={isLoading}
      />

      {selectedEntity && selectedEntity.value !== 'all' && (
        <Button onClick={onReset} disabled={isLoading} size="sm" variant="default">
          <XIcon className="size-3" /> Reset
        </Button>
      )}
    </ButtonsGroup>
  );
}

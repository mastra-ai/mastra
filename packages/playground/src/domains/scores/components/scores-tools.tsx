import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
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
    <div className="flex items-center gap-2">
      <Select
        value={selectedEntity?.value || ''}
        onValueChange={(val: string) => {
          const entity = entityOptions?.find(entity => entity.value === val);
          if (entity) {
            onEntityChange(entity);
          }
        }}
        disabled={isLoading}
      >
        <SelectTrigger aria-label="Filter by Entity" size="md" className="whitespace-nowrap">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {(entityOptions || []).map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedEntity && selectedEntity.value !== 'all' && (
        <Button onClick={onReset} disabled={isLoading} size="sm" variant="default" icon={<XIcon />}>
          Reset
        </Button>
      )}
    </div>
  );
}

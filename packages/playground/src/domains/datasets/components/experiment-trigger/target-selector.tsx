import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { useTargetOptions } from './use-target-options';
import type { TargetType } from './use-target-options';

export type { TargetType };

export interface TargetSelectorProps {
  targetType: TargetType | '';
  setTargetType: (type: TargetType | '') => void;
  targetId: string;
  setTargetId: (id: string) => void;
  container?: React.RefObject<HTMLElement | null>;
}

const targetTypeOptions = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'scorer', label: 'Scorer' },
];

export function TargetSelector({ targetType, setTargetType, targetId, setTargetId, container }: TargetSelectorProps) {
  const { targetOptions, isLoading: isTargetsLoading } = useTargetOptions(targetType);

  // Reset targetId when type changes
  const handleTypeChange = (value: string) => {
    setTargetType(value as TargetType);
    setTargetId('');
  };

  const targetLabel = targetType === 'agent' ? 'Agent' : targetType === 'workflow' ? 'Workflow' : 'Scorer';

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel>Target Type</FieldLabel>
        <Combobox
          options={targetTypeOptions}
          value={targetType}
          onValueChange={handleTypeChange}
          placeholder="Select target type"
          searchPlaceholder="Search types..."
          emptyText="No types available"
          container={container}
        />
      </Field>

      {targetType && (
        <Field>
          <FieldLabel>{targetLabel}</FieldLabel>
          <Combobox
            options={targetOptions}
            value={targetId}
            onValueChange={setTargetId}
            placeholder={`Select ${targetType}`}
            searchPlaceholder="Search..."
            emptyText="No targets available"
            disabled={isTargetsLoading}
            container={container}
          />
        </Field>
      )}
    </div>
  );
}

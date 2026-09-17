import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Entry } from '@mastra/playground-ui/components/Entry';
import { Label } from '@mastra/playground-ui/components/Label';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId } from 'react';

export interface ModelSettingsMethod {
  value: string;
  label: string;
  unavailable?: string;
}
function MethodRadio({ option, disabled, id }: { option: ModelSettingsMethod; disabled: boolean; id: string }) {
  const descriptionId = option.unavailable ? `${id}-unavailable` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <RadioGroupItem
          value={option.value}
          id={id}
          aria-describedby={descriptionId}
          className="text-neutral6"
          disabled={disabled || Boolean(option.unavailable)}
        />
        <Label
          className={cn('text-ui-md text-neutral6', option.unavailable && 'cursor-not-allowed text-neutral3!')}
          htmlFor={id}
        >
          {option.label}
        </Label>
      </div>
      {option.unavailable && (
        <p id={descriptionId} className="text-ui-sm text-neutral3 ml-6">
          {option.unavailable}
        </p>
      )}
    </div>
  );
}

export function ComposerRunSettings({
  method,
  methods,
  onMethodChange,
  canEdit = true,
  requireToolApproval = false,
  onToolApprovalChange,
}: {
  method?: string;
  methods: ModelSettingsMethod[];
  onMethodChange: (method: string) => void;
  canEdit?: boolean;
  requireToolApproval?: boolean;
  onToolApprovalChange: (required: boolean) => void;
}) {
  const methodId = useId();
  return (
    <>
      <Entry label="Chat Method">
        <RadioGroup
          value={method}
          disabled={!canEdit}
          onValueChange={selected => {
            if (canEdit) onMethodChange(selected);
          }}
          className="flex flex-col gap-3"
        >
          {methods.map(option => (
            <MethodRadio key={option.value} option={option} disabled={!canEdit} id={`${methodId}-${option.value}`} />
          ))}
        </RadioGroup>
      </Entry>
      <Entry label="Require Tool Approval">
        <Checkbox
          aria-label="Require Tool Approval"
          checked={requireToolApproval}
          disabled={!canEdit}
          onCheckedChange={checked => {
            if (canEdit) onToolApprovalChange(checked);
          }}
        />
      </Entry>
    </>
  );
}

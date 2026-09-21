import { FieldBlock, fieldErrorId, TextareaFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId, useState } from 'react';
import type { WorkflowInputDataProps } from '../workflow-input-data';
import { getProcessorMessage, updateProcessorMessage, withPhaseRole } from './processor-input';
import type { ProcessorDraft } from './processor-input';
import { FormSubmitRow } from '@/lib/form/components/form-submit-row';

const PROCESSOR_PHASES = [
  { value: 'input', label: 'Input - Process input messages before LLM' },
  { value: 'inputStep', label: 'Input Step - Process at each agentic loop step' },
  { value: 'outputStream', label: 'Output Stream - Process streaming chunks' },
  { value: 'outputResult', label: 'Output Result - Process complete output' },
  { value: 'outputStep', label: 'Output Step - Process after each LLM response' },
];

type WorkflowProcessorInputProps = Omit<WorkflowInputDataProps, 'defaultValues'> & {
  value: ProcessorDraft;
  onChange: (draft: ProcessorDraft) => void;
};

export const WorkflowProcessorInput = ({
  schema,
  value,
  onChange,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
  submitActions,
  leftActions,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
}: WorkflowProcessorInputProps) => {
  const messageName = useId();
  const phaseId = useId();
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    setErrors([]);

    const result = schema.safeParse(value);
    if (!result.success) {
      setErrors(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
      return;
    }
    onSubmit(result.data);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <FieldBlock.Label name={phaseId} htmlFor={phaseId}>
          Phase
        </FieldBlock.Label>
        <Select
          value={value.phase}
          onValueChange={phase => {
            setErrors([]);
            onChange(withPhaseRole({ ...value, phase }));
          }}
          disabled={isSubmitLoading}
        >
          <SelectTrigger
            id={phaseId}
            className="w-full"
            aria-invalid={errors.length > 0 ? true : undefined}
            aria-describedby={errors.length > 0 ? fieldErrorId('workflow-processor-input') : undefined}
          >
            <SelectValue placeholder="Select phase" />
          </SelectTrigger>
          <SelectContent>
            {PROCESSOR_PHASES.map(phaseOption => (
              <SelectItem key={phaseOption.value} value={phaseOption.value}>
                {phaseOption.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Txt variant="ui-xs" className="text-neutral4">
          {PROCESSOR_PHASES.find(phaseOption => phaseOption.value === value.phase)?.label}
        </Txt>
      </div>

      <TextareaFieldBlock
        name={messageName}
        label="Test Message"
        value={getProcessorMessage(value)}
        onChange={event => {
          setErrors([]);
          onChange(withPhaseRole(updateProcessorMessage(value, event.target.value)));
        }}
        placeholder="Enter a test message..."
        rows={4}
        disabled={isSubmitLoading}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={errors.length > 0 ? fieldErrorId('workflow-processor-input') : undefined}
      />

      {errors.length > 0 && (
        <FieldBlock.ErrorMsg name="workflow-processor-input">
          <span className="space-y-1">
            {errors.map(error => (
              <span key={error} className="block">
                {error}
              </span>
            ))}
          </span>
        </FieldBlock.ErrorMsg>
      )}

      {children}

      <FormSubmitRow
        isSubmitLoading={isSubmitLoading}
        submitButtonLabel={submitButtonLabel}
        submitActions={submitActions}
        leftActions={leftActions}
        submitButtonIcon={submitButtonIcon}
        submitButtonVariant={submitButtonVariant}
        submitButtonFullWidth={submitButtonFullWidth}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

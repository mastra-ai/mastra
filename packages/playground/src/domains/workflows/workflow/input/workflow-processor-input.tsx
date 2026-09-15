import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId, useState } from 'react';
import type { WorkflowInputDataProps } from '../workflow-input-data';
import { getProcessorMessage, getProcessorPhase, updateProcessorMessage, withPhaseRole } from './processor-input';
import { FormSubmitRow } from '@/lib/form/components/form-submit-row';

const PROCESSOR_PHASES = [
  { value: 'input', label: 'Input - Process input messages before LLM' },
  { value: 'inputStep', label: 'Input Step - Process at each agentic loop step' },
  { value: 'outputStream', label: 'Output Stream - Process streaming chunks' },
  { value: 'outputResult', label: 'Output Result - Process complete output' },
  { value: 'outputStep', label: 'Output Step - Process after each LLM response' },
];

export const WorkflowProcessorInput = ({
  schema,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
  submitActions,
  leftActions,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  onValuesChange,
}: WorkflowInputDataProps & { onValuesChange: (value: unknown) => void }) => {
  const messageId = useId();
  const phaseId = useId();
  const message = getProcessorMessage(defaultValues);
  const phase = getProcessorPhase(defaultValues);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    setErrors([]);

    const result = schema.safeParse(withPhaseRole(defaultValues));
    if (!result.success) {
      setErrors(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
      return;
    }
    onSubmit(result.data);
  };

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div role="alert" className="border-accent2 rounded-lg border p-2">
          <Txt as="p" variant="ui-md" className="text-accent2 font-semibold">
            {errors.length} errors found
          </Txt>
          <ul className="list-inside list-disc">
            {errors.map((error, index) => (
              <li key={index} className="text-ui-sm text-accent2">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Txt as="label" htmlFor={phaseId} variant="ui-sm" className="text-neutral3">
          Phase
        </Txt>
        <Select
          value={phase}
          onValueChange={phase => onValuesChange({ ...defaultValues, phase })}
          disabled={isSubmitLoading}
        >
          <SelectTrigger id={phaseId} className="w-full">
            <SelectValue placeholder="Select phase" />
          </SelectTrigger>
          <SelectContent>
            {PROCESSOR_PHASES.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Txt variant="ui-xs" className="text-neutral4">
          {PROCESSOR_PHASES.find(p => p.value === phase)?.label}
        </Txt>
      </div>

      <div className="space-y-2">
        <Txt as="label" htmlFor={messageId} variant="ui-sm" className="text-neutral3">
          Test Message
        </Txt>
        <textarea
          id={messageId}
          value={message}
          onChange={event => onValuesChange(updateProcessorMessage(defaultValues, event.target.value))}
          placeholder="Enter a test message..."
          rows={4}
          disabled={isSubmitLoading}
          className="border-border1 text-ui-sm text-neutral6 placeholder:text-neutral3 focus:ring-accent1 w-full rounded-md border bg-transparent p-3 focus:ring-2 focus:outline-hidden disabled:opacity-50"
        />
      </div>

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

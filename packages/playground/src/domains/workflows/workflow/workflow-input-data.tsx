import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { ZodSchema } from 'zod';

import { createProcessorInput } from './input/processor-input';
import { WorkflowJsonInput } from './input/workflow-json-input';
import { WorkflowProcessorInput } from './input/workflow-processor-input';
import { WorkflowInputTypeToggle } from './workflow-input-type-toggle';
import type { WorkflowInputType } from './workflow-input-type-toggle';
import { DynamicForm } from '@/lib/form';

type InputType = WorkflowInputType;

export interface WorkflowInputDataProps {
  schema: ZodSchema;
  defaultValues?: any;
  isSubmitLoading: boolean;
  submitButtonLabel: string;
  onSubmit: (data: any) => void;
  children?: React.ReactNode;
  isProcessorWorkflow?: boolean;
  submitActions?: React.ReactNode;
  leftActions?: React.ReactNode;
  headingSlot?: ReactNode;
  collapsible?: boolean;
  submitButtonIcon?: ReactNode;
  submitButtonVariant?: React.ComponentProps<typeof Button>['variant'];
  submitButtonFullWidth?: boolean;
  hideInputTypeLabel?: boolean;
  inputTypeLabel?: string;
  hideHeading?: boolean;
}

export const WorkflowInputData = ({
  schema,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
  isProcessorWorkflow,
  submitActions,
  leftActions,
  headingSlot,
  collapsible = true,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  hideInputTypeLabel,
  inputTypeLabel = 'Run input',
  hideHeading,
}: WorkflowInputDataProps) => {
  const [draft, setDraft] = useState<
    { type: 'json'; value: string } | { type: 'form'; value: unknown } | { type: 'simple'; value: unknown }
  >(() =>
    isProcessorWorkflow
      ? { type: 'simple', value: defaultValues ?? createProcessorInput() }
      : { type: 'form', value: defaultValues },
  );
  // The Form view is uncontrolled: state here would only re-render this tree on every keystroke.
  const formValues = useRef<unknown>(defaultValues);
  const [errors, setErrors] = useState<string[]>([]);

  function parseJsonDraft(text: string) {
    try {
      return { success: true, value: JSON.parse(text) as unknown } as const;
    } catch (error) {
      setErrors([error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON']);
      return { success: false } as const;
    }
  }

  function submitJsonDraft(text: string) {
    const json = parseJsonDraft(text);
    if (!json.success) return;
    const result = schema.safeParse(json.value);
    if (result.success) onSubmit(result.data);
    else setErrors(result.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`));
  }

  function changeInputType(type: InputType) {
    if (type === draft.type) return;
    setErrors([]);
    const value = draft.type === 'form' ? formValues.current : draft.value;
    if (type === 'json') {
      setDraft({ type, value: JSON.stringify(value === undefined ? {} : value, null, 2) });
      return;
    }
    if (draft.type === 'json') {
      const json = parseJsonDraft(draft.value);
      if (json.success) setDraft({ type, value: json.value });
      return;
    }
    setDraft({ type, value });
  }

  const defaultHeading = (
    <Txt as="span" variant="ui-md" className="text-neutral5 font-semibold">
      Trigger a run
    </Txt>
  );
  const inputTypeToggle = (
    <WorkflowInputTypeToggle
      value={draft.type}
      onChange={changeInputType}
      disabled={isSubmitLoading}
      includeSimple={isProcessorWorkflow}
      compact={!collapsible && !hideHeading}
    />
  );

  const body = (
    <>
      {!hideInputTypeLabel && (
        <div className="flex justify-between gap-3 px-5 py-3">
          <Txt as="p" variant="ui-sm" className="text-neutral3">
            {inputTypeLabel}
          </Txt>
          {!collapsible && !hideHeading && <div className="shrink-0">{inputTypeToggle}</div>}
        </div>
      )}

      <div className="px-5">
        {(collapsible || hideHeading || hideInputTypeLabel) && <div className="pb-4">{inputTypeToggle}</div>}

        <div
          className={cn('pb-4', {
            'opacity-50 pointer-events-none': isSubmitLoading,
          })}
        >
          {draft.type === 'json' ? (
            <WorkflowJsonInput
              value={draft.value}
              onChange={value => {
                setDraft({ type: 'json', value });
                setErrors([]);
              }}
              errors={errors}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={() => submitJsonDraft(draft.value)}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowJsonInput>
          ) : draft.type === 'simple' && isProcessorWorkflow ? (
            <WorkflowProcessorInput
              schema={schema}
              onValuesChange={value => setDraft({ type: 'simple', value })}
              defaultValues={draft.value}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={onSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowProcessorInput>
          ) : (
            <WorkflowFormInput
              schema={schema}
              onValuesChange={value => {
                formValues.current = value;
              }}
              defaultValues={draft.value}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={onSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowFormInput>
          )}
        </div>
      </div>
    </>
  );

  if (!collapsible) {
    return (
      <>
        {!hideHeading && <div className="border-border1/50 border-b pb-3">{headingSlot ?? defaultHeading}</div>}
        <div>{body}</div>
      </>
    );
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-2 pb-3 text-left">
        <ChevronRight className="text-neutral3 h-4 w-4 shrink-0" />
        {headingSlot ?? defaultHeading}
      </CollapsibleTrigger>

      <CollapsibleContent>{body}</CollapsibleContent>
    </Collapsible>
  );
};

const WorkflowFormInput = ({
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
}: WorkflowInputDataProps & { onValuesChange: (value: unknown) => void }) => (
  <DynamicForm
    schema={schema}
    defaultValues={defaultValues}
    onValuesChange={onValuesChange}
    isSubmitLoading={isSubmitLoading}
    submitButtonLabel={submitButtonLabel}
    submitButtonIcon={submitButtonIcon}
    submitButtonVariant={submitButtonVariant}
    submitButtonFullWidth={submitButtonFullWidth}
    onSubmit={onSubmit}
    readOnly={isSubmitLoading}
    submitActions={submitActions}
    leftActions={leftActions}
  >
    {children}
  </DynamicForm>
);

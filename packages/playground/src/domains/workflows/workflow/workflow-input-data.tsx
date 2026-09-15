import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
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
  withoutSubmit?: boolean;
  isReadOnly?: boolean;
  disableSubmit?: boolean;
  children?: React.ReactNode;
  isProcessorWorkflow?: boolean;
  submitActions?: React.ReactNode;
  leftActions?: React.ReactNode;
  heading?: string;
  headingSlot?: ReactNode;
  collapsible?: boolean;
  headingClassName?: string;
  submitButtonClassName?: string;
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
  withoutSubmit,
  isReadOnly,
  disableSubmit,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
  isProcessorWorkflow,
  submitActions,
  leftActions,
  heading,
  headingSlot,
  collapsible = true,
  headingClassName,
  submitButtonClassName,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  hideInputTypeLabel,
  inputTypeLabel = 'Run input',
  hideHeading,
}: WorkflowInputDataProps) => {
  const [draft, setDraft] = useState<
    { type: 'json'; value: string } | { type: 'form'; value: unknown } | { type: 'simple'; value: unknown }
  >(() => ({
    type: isProcessorWorkflow ? 'simple' : 'form',
    value: isProcessorWorkflow ? createProcessorInput(defaultValues) : defaultValues,
  }));
  const [errors, setErrors] = useState<string[]>([]);

  function parseJsonInput(text: string) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      setErrors([error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON']);
      return { success: false } as const;
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      setErrors(result.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`));
      return { success: false } as const;
    }
    return { success: true, value, parsed: result.data } as const;
  }

  function changeInputType(type: InputType) {
    if (type === draft.type) return;
    setErrors([]);
    if (type === 'json') {
      setDraft({ type, value: JSON.stringify(draft.value === undefined ? {} : draft.value, null, 2) });
      return;
    }
    if (draft.type === 'json') {
      const result = parseJsonInput(draft.value);
      if (result.success) setDraft({ type, value: result.value });
      return;
    }
    setDraft({ type, value: draft.value });
  }

  const defaultHeading = (
    <Txt as="span" variant="ui-md" className={cn('text-neutral5 font-semibold', headingClassName)}>
      {heading ?? (withoutSubmit ? 'Run input' : 'Trigger a run')}
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
          {draft.type === 'simple' ? (
            <WorkflowProcessorInput
              schema={schema}
              onValuesChange={value => setDraft({ type: 'simple', value })}
              defaultValues={draft.value}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={onSubmit}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly || isSubmitLoading}
              disableSubmit={disableSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowProcessorInput>
          ) : draft.type === 'form' ? (
            <WorkflowFormInput
              schema={schema}
              onValuesChange={value => setDraft({ type: 'form', value })}
              defaultValues={draft.value}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={onSubmit}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly || isSubmitLoading}
              disableSubmit={disableSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowFormInput>
          ) : (
            <WorkflowJsonInput
              value={draft.value}
              onChange={value => {
                setDraft({ type: 'json', value });
                setErrors([]);
              }}
              errors={errors}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={() => {
                const result = parseJsonInput(draft.value);
                if (result.success) onSubmit(result.parsed);
              }}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly || isSubmitLoading}
              disableSubmit={disableSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowJsonInput>
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
  withoutSubmit,
  isReadOnly,
  disableSubmit,
  children,
  submitActions,
  leftActions,
  submitButtonClassName,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  onValuesChange,
}: WorkflowInputDataProps & { onValuesChange: (value: unknown) => void }) => (
  <DynamicForm
    schema={schema}
    preserveEmptyValues
    defaultValues={defaultValues}
    onValuesChange={onValuesChange}
    isSubmitLoading={isSubmitLoading}
    submitButtonLabel={submitButtonLabel}
    submitButtonClassName={submitButtonClassName}
    submitButtonIcon={submitButtonIcon}
    submitButtonVariant={submitButtonVariant}
    submitButtonFullWidth={submitButtonFullWidth}
    onSubmit={withoutSubmit ? undefined : onSubmit}
    readOnly={isReadOnly}
    disableSubmit={disableSubmit}
    submitActions={submitActions}
    leftActions={leftActions}
  >
    {children}
  </DynamicForm>
);

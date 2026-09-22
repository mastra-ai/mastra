import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { ZodSchema } from 'zod';

import { createProcessorInput, parseProcessorDraft } from './input/processor-input';
import type { ProcessorDraft } from './input/processor-input';
import { WorkflowJsonInput } from './input/workflow-json-input';
import { WorkflowProcessorInput } from './input/workflow-processor-input';
import { WorkflowInputTypeToggle } from './workflow-input-type-toggle';
import type { WorkflowInputType } from './workflow-input-type-toggle';
import { DynamicForm } from '@/lib/form';
import { isPlainObject } from '@/lib/form/utils';
import { getBaseSchema } from '@/lib/form/zod-provider/compat';
import { inferFieldType } from '@/lib/form/zod-provider/field-type-inference';

export interface WorkflowInputDataProps {
  schema: ZodSchema;
  defaultValues?: unknown;
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

type InputDraft =
  | { type: 'json'; value: string }
  | { type: 'form'; value: unknown }
  | { type: 'simple'; value: ProcessorDraft };

type DraftValue = { ok: true; value: unknown } | { ok: false; error: string };

const defaultSubmitIcon = (
  <Icon>
    <Play />
  </Icon>
);

function createInitialDraft(defaultValues: unknown, isProcessorWorkflow: boolean | undefined): InputDraft {
  if (!isProcessorWorkflow) return { type: 'form', value: defaultValues };
  const input = defaultValues ?? createProcessorInput();
  const draft = parseProcessorDraft(input);
  return draft ? { type: 'simple', value: draft } : { type: 'json', value: JSON.stringify(input, null, 2) };
}

function parseJsonDraft(text: string): DraftValue {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON' };
  }
}

function getFormShapeError(schema: ZodSchema, value: unknown) {
  const fieldType = inferFieldType(getBaseSchema(schema));
  if (fieldType === 'object' && !isPlainObject(value))
    return 'Form input requires a JSON object. Correct the JSON first.';
  if (fieldType === 'array' && !Array.isArray(value))
    return 'Form input requires a JSON array. Correct the JSON first.';
  return undefined;
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
  submitButtonIcon = defaultSubmitIcon,
  submitButtonVariant = 'primary',
  submitButtonFullWidth,
  hideInputTypeLabel,
  inputTypeLabel = 'Run input',
  hideHeading,
}: WorkflowInputDataProps) => {
  const [draft, setDraft] = useState(() => createInitialDraft(defaultValues, isProcessorWorkflow));
  // The Form view is uncontrolled: state here would only re-render this tree on every keystroke.
  const formValues = useRef<unknown>(defaultValues);
  const [errors, setErrors] = useState<string[]>([]);

  function readDraftValue(): DraftValue {
    if (draft.type === 'json') return parseJsonDraft(draft.value);
    return { ok: true, value: draft.type === 'form' ? formValues.current : draft.value };
  }

  function submitJsonDraft(text: string) {
    const json = parseJsonDraft(text);
    if (!json.ok) return setErrors([json.error]);
    const result = schema.safeParse(json.value);
    if (result.success) onSubmit(result.data);
    else setErrors(result.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`));
  }

  function changeInputType(type: WorkflowInputType) {
    if (type === draft.type) return;
    setErrors([]);
    const current = readDraftValue();
    if (!current.ok) return setErrors([current.error]);
    if (type === 'json') {
      return setDraft({ type, value: JSON.stringify(current.value === undefined ? {} : current.value, null, 2) });
    }
    if (type === 'simple') {
      const processorDraft = parseProcessorDraft(current.value);
      if (processorDraft) return setDraft({ type, value: processorDraft });
      return setErrors([
        'Simple input requires a messages array with text parts and a string phase. Correct the JSON first.',
      ]);
    }
    const formShapeError = getFormShapeError(schema, current.value);
    return formShapeError ? setErrors([formShapeError]) : setDraft({ type, value: current.value });
  }

  const defaultHeading = (
    <Txt as="span" variant="subheading" tone="ink">
      Trigger a run
    </Txt>
  );
  const toggleSitsInLabelRow = !collapsible && !hideHeading;
  const toggleSitsAboveInput = collapsible || hideHeading || hideInputTypeLabel;
  const inputTypeToggle = (
    <WorkflowInputTypeToggle
      value={draft.type}
      onChange={changeInputType}
      disabled={isSubmitLoading}
      includeSimple={isProcessorWorkflow}
      compact={toggleSitsInLabelRow}
    />
  );

  const body = (
    <>
      {!hideInputTypeLabel && (
        <div className="flex justify-between gap-3 px-5 py-3">
          <Txt as="p" variant="caption" tone="muted">
            {inputTypeLabel}
          </Txt>
          {toggleSitsInLabelRow && <div className="shrink-0">{inputTypeToggle}</div>}
        </div>
      )}

      <div className="px-5">
        {toggleSitsAboveInput && <div className="pb-4">{inputTypeToggle}</div>}

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
              value={draft.value}
              onChange={value => setDraft({ type: 'simple', value })}
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
        {!hideHeading && <div className="border-border/50 border-b pb-3">{headingSlot ?? defaultHeading}</div>}
        <div>{body}</div>
      </>
    );
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-2 pb-3 text-left">
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        {headingSlot ?? defaultHeading}
      </CollapsibleTrigger>

      <CollapsibleContent keepMounted>{body}</CollapsibleContent>
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

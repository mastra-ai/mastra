import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, Loader2, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { ZodSchema } from 'zod';

import { WorkflowInputTypeToggle } from './workflow-input-type-toggle';
import type { WorkflowInputType } from './workflow-input-type-toggle';
import { DynamicForm } from '@/lib/form';

type InputType = WorkflowInputType;

type WorkflowSubmitRowProps = Pick<
  WorkflowInputDataProps,
  | 'isSubmitLoading'
  | 'submitButtonLabel'
  | 'disableSubmit'
  | 'submitActions'
  | 'leftActions'
  | 'submitButtonClassName'
  | 'submitButtonIcon'
  | 'submitButtonVariant'
> & {
  onSubmit: () => void;
};

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
  const [type, setType] = useState<InputType>(isProcessorWorkflow ? 'simple' : 'form');
  const processorInputKey = useMemo(
    () =>
      JSON.stringify({
        message: getDefaultProcessorMessage(defaultValues),
        phase: getDefaultProcessorPhase(defaultValues),
      }),
    [defaultValues],
  );

  const defaultHeading = (
    <Txt as="span" variant="ui-md" className={cn('text-neutral5 font-semibold', headingClassName)}>
      {heading ?? (withoutSubmit ? 'Run input' : 'Trigger a run')}
    </Txt>
  );
  const inputTypeToggle = (
    <WorkflowInputTypeToggle
      value={type}
      onChange={setType}
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
          {type === 'simple' && isProcessorWorkflow ? (
            <WorkflowProcessorInput
              key={processorInputKey}
              schema={schema}
              defaultValues={defaultValues}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              onSubmit={onSubmit}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly}
              disableSubmit={disableSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowProcessorInput>
          ) : type === 'form' ? (
            <WorkflowFormInput
              schema={schema}
              defaultValues={defaultValues}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              submitButtonIcon={submitButtonIcon}
              submitButtonVariant={submitButtonVariant}
              submitButtonFullWidth={submitButtonFullWidth}
              onSubmit={onSubmit}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly}
              disableSubmit={disableSubmit}
              submitActions={submitActions}
              leftActions={leftActions}
            >
              {children}
            </WorkflowFormInput>
          ) : (
            <WorkflowJsonInput
              schema={schema}
              defaultValues={defaultValues}
              isSubmitLoading={isSubmitLoading}
              submitButtonLabel={submitButtonLabel}
              submitButtonClassName={submitButtonClassName}
              onSubmit={onSubmit}
              withoutSubmit={withoutSubmit}
              isReadOnly={isReadOnly}
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

const WorkflowSubmitRow = ({
  isSubmitLoading,
  submitButtonLabel,
  disableSubmit,
  submitActions,
  leftActions,
  submitButtonClassName,
  submitButtonIcon,
  submitButtonVariant,
  onSubmit,
}: WorkflowSubmitRowProps) => (
  <div className="flex items-center justify-between gap-1">
    {leftActions ?? <div />}
    <div className="flex items-center gap-1">
      {submitActions}
      <Button
        variant={submitButtonVariant ?? 'primary'}
        onClick={onSubmit}
        disabled={isSubmitLoading || disableSubmit}
        className={submitButtonClassName}
      >
        {isSubmitLoading ? (
          <Icon>
            <Loader2 className="animate-spin" />
          </Icon>
        ) : (
          (submitButtonIcon ?? (
            <Icon>
              <Play />
            </Icon>
          ))
        )}
        {submitButtonLabel}
      </Button>
    </div>
  </div>
);

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
}: WorkflowInputDataProps) => (
  <DynamicForm
    schema={schema}
    defaultValues={defaultValues}
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

const WorkflowJsonInput = ({
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
}: WorkflowInputDataProps) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [inputData, setInputData] = useState<string>(() => JSON.stringify(defaultValues ?? {}, null, 2));

  const handleSubmit = () => {
    setErrors([]);

    try {
      const result = schema.safeParse(JSON.parse(inputData));
      if (!result.success) {
        setErrors(result.error.issues.map(e => `[${e.path.join('.')}] ${e.message}`));
      } else {
        onSubmit(result.data);
      }
    } catch {
      setErrors(['Invalid JSON provided']);
    }
  };

  let data = {};
  try {
    data = JSON.parse(inputData);
  } catch {
    data = {};
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="border-accent2 rounded-lg border p-2">
          <Txt as="p" variant="ui-md" className="text-accent2 font-semibold">
            {errors.length} errors found
          </Txt>

          <ul className="list-inside list-disc">
            {errors.map((error, idx) => (
              <li key={idx} className="text-ui-sm text-accent2">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Txt as="label" variant="ui-sm" className="text-neutral3 block pb-1">
          Input data
        </Txt>
        <CodeEditor data={data} onChange={setInputData} editable={!isReadOnly} />
      </div>

      {children}

      {withoutSubmit ? null : (
        <WorkflowSubmitRow
          isSubmitLoading={isSubmitLoading}
          submitButtonLabel={submitButtonLabel}
          disableSubmit={disableSubmit}
          submitActions={submitActions}
          leftActions={leftActions}
          submitButtonClassName={submitButtonClassName}
          submitButtonIcon={submitButtonIcon}
          submitButtonVariant={submitButtonVariant}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

const PROCESSOR_PHASES = [
  { value: 'input', label: 'Input - Process input messages before LLM' },
  { value: 'inputStep', label: 'Input Step - Process at each agentic loop step' },
  { value: 'outputStream', label: 'Output Stream - Process streaming chunks' },
  { value: 'outputResult', label: 'Output Result - Process complete output' },
  { value: 'outputStep', label: 'Output Step - Process after each LLM response' },
];

const DEFAULT_PROCESSOR_MESSAGE = 'Hello, this is a test message.';
const DEFAULT_PROCESSOR_PHASE = 'input';

function getDefaultProcessorMessage(defaultValues: any) {
  const textPart = defaultValues?.messages?.[0]?.content?.parts?.find((part: any) => part?.type === 'text');
  return typeof textPart?.text === 'string' ? textPart.text : DEFAULT_PROCESSOR_MESSAGE;
}

function getDefaultProcessorPhase(defaultValues: any) {
  return typeof defaultValues?.phase === 'string' ? defaultValues.phase : DEFAULT_PROCESSOR_PHASE;
}

const WorkflowProcessorInput = ({
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
}: WorkflowInputDataProps) => {
  const [message, setMessage] = useState(() => getDefaultProcessorMessage(defaultValues));
  const [phase, setPhase] = useState(() => getDefaultProcessorPhase(defaultValues));
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    setErrors([]);

    // For output phases (outputStep, outputResult), use 'assistant' role
    const isOutputPhase = phase === 'outputStep' || phase === 'outputResult';
    const messageRole = isOutputPhase ? 'assistant' : 'user';

    // Construct the data in the format processor workflows expect
    const data = {
      messages: [
        {
          id: crypto.randomUUID(),
          role: messageRole,
          createdAt: new Date().toISOString(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: message }],
          },
        },
      ],
      phase,
    };

    try {
      const result = schema.safeParse(data);
      if (!result.success) {
        setErrors(result.error.issues.map(e => `[${e.path.join('.')}] ${e.message}`));
      } else {
        onSubmit(result.data);
      }
    } catch {
      setErrors(['Error processing input']);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="border-accent2 rounded-lg border p-2">
          <Txt as="p" variant="ui-md" className="text-accent2 font-semibold">
            {errors.length} errors found
          </Txt>
          <ul className="list-inside list-disc">
            {errors.map((error, idx) => (
              <li key={idx} className="text-ui-sm text-accent2">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Txt as="label" variant="ui-sm" className="text-neutral3">
          Phase
        </Txt>
        <Select value={phase} onValueChange={setPhase} disabled={isReadOnly}>
          <SelectTrigger className="w-full">
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
        <Txt as="label" variant="ui-sm" className="text-neutral3">
          Test Message
        </Txt>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter a test message..."
          rows={4}
          disabled={isReadOnly}
          className="border-border1 text-ui-sm text-neutral6 placeholder:text-neutral3 focus:ring-accent1 w-full rounded-md border bg-transparent p-3 focus:ring-2 focus:outline-hidden disabled:opacity-50"
        />
      </div>

      {children}

      {withoutSubmit ? null : (
        <WorkflowSubmitRow
          isSubmitLoading={isSubmitLoading}
          submitButtonLabel={submitButtonLabel}
          disableSubmit={disableSubmit}
          submitActions={submitActions}
          leftActions={leftActions}
          submitButtonClassName={submitButtonClassName}
          submitButtonIcon={submitButtonIcon}
          submitButtonVariant={submitButtonVariant}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

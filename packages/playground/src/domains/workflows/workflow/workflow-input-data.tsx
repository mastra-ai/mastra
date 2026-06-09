import {
  Button,
  CodeEditor,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Txt,
  cn,
} from '@mastra/playground-ui';
import { ChevronRight, Loader2, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { ZodSchema } from 'zod';

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
  inputTypeBordered?: boolean;
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
  inputTypeBordered,
  hideHeading,
}: WorkflowInputDataProps) => {
  const [type, setType] = useState<InputType>(isProcessorWorkflow ? 'simple' : 'form');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const defaultHeading = (
    <Txt as="span" variant="ui-md" className={cn('text-neutral5 font-semibold', headingClassName)}>
      {heading ?? (withoutSubmit ? 'Run input' : 'Trigger a run')}
    </Txt>
  );

  const body = (
    <>
      {!hideInputTypeLabel && (
        <Txt as="p" variant="ui-sm" className="text-neutral3 pb-3">
          {inputTypeLabel}
        </Txt>
      )}
      <div className={cn({ 'pl-3 border-l border-dashed border-border1': inputTypeBordered })}>
        <div className="pb-4">
          <WorkflowInputTypeToggle
            value={type}
            onChange={setType}
            disabled={isSubmitLoading}
            includeSimple={isProcessorWorkflow}
          />
        </div>

        <div
          className={cn('pb-4', {
            'opacity-50 pointer-events-none': isSubmitLoading,
          })}
        >
          {type === 'simple' && isProcessorWorkflow ? (
            <SimpleProcessorInput
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
            </SimpleProcessorInput>
          ) : type === 'form' ? (
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
          ) : (
            <JSONInput
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
            </JSONInput>
          )}
        </div>
      </div>
    </>
  );

  if (!collapsible) {
    return (
      <div>
        {!hideHeading && <div className="pb-3">{headingSlot ?? defaultHeading}</div>}
        {body}
      </div>
    );
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-2 pb-3 text-left">
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral3" />
        {headingSlot ?? defaultHeading}
      </CollapsibleTrigger>

      <CollapsibleContent>{body}</CollapsibleContent>
    </Collapsible>
  );
};

const JSONInput = ({
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
        <div className="border border-accent2 rounded-lg p-2">
          <Txt as="p" variant="ui-md" className="text-accent2 font-semibold">
            {errors.length} errors found
          </Txt>

          <ul className="list-disc list-inside">
            {errors.map((error, idx) => (
              <li key={idx} className="text-ui-sm text-accent2">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Txt as="label" variant="ui-sm" className="text-neutral3 pb-1 block">
          Input data
        </Txt>
        <CodeEditor data={data} onChange={setInputData} editable={!isReadOnly} />
      </div>

      {children}

      {withoutSubmit ? null : (
        <div className="flex items-center justify-between gap-1">
          {leftActions ?? <div />}
          <div className="flex items-center gap-1">
            {submitActions}
            <Button
              variant={submitButtonVariant ?? 'primary'}
              onClick={handleSubmit}
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

const SimpleProcessorInput = ({
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

  useEffect(() => {
    setMessage(getDefaultProcessorMessage(defaultValues));
    setPhase(getDefaultProcessorPhase(defaultValues));
  }, [defaultValues]);

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
        <div className="border border-accent2 rounded-lg p-2">
          <Txt as="p" variant="ui-md" className="text-accent2 font-semibold">
            {errors.length} errors found
          </Txt>
          <ul className="list-disc list-inside">
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
          className="w-full bg-transparent border border-border1 rounded-md p-3 text-ui-sm text-neutral6 placeholder:text-neutral3 focus:outline-hidden focus:ring-2 focus:ring-accent1 disabled:opacity-50"
        />
      </div>

      {children}

      {withoutSubmit ? null : (
        <div className="flex items-center justify-between gap-1">
          {leftActions ?? <div />}
          <div className="flex items-center gap-1">
            {submitActions}
            <Button
              variant={submitButtonVariant ?? 'primary'}
              onClick={handleSubmit}
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
      )}
    </div>
  );
};

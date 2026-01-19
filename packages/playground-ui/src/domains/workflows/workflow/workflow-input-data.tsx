import { DynamicForm } from '@/lib/form';
import { Button } from '@/ds/components/Button/Button';
import { CodeEditor, useCodemirrorTheme } from '@/ds/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Label } from '@/ds/components/Label';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

import { ZodSchema } from 'zod';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';

type InputType = 'simple' | 'form' | 'json';

export interface WorkflowInputDataProps {
  schema: ZodSchema;
  defaultValues?: any;
  isSubmitLoading: boolean;
  submitButtonLabel: string;
  onSubmit: (data: any) => void;
  withoutSubmit?: boolean;
  children?: React.ReactNode;
  isProcessorWorkflow?: boolean;
}

export const WorkflowInputData = ({
  schema,
  defaultValues,
  withoutSubmit,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
  isProcessorWorkflow,
}: WorkflowInputDataProps) => {
  const [type, setType] = useState<InputType>(isProcessorWorkflow ? 'simple' : 'form');

  return (
    <div>
      <RadioGroup
        disabled={isSubmitLoading}
        value={type}
        onValueChange={value => setType(value as InputType)}
        className="pb-4"
      >
        <div className="flex flex-row gap-4">
          {isProcessorWorkflow && (
            <div className="flex items-center gap-3">
              <RadioGroupItem value="simple" id="simple" />
              <Label htmlFor="simple" className="!text-neutral3 text-ui-sm">
                Simple
              </Label>
            </div>
          )}
          <div className="flex items-center gap-3">
            <RadioGroupItem value="form" id="form" />
            <Label htmlFor="form" className="!text-neutral3 text-ui-sm">
              Form
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="json" id="json" />
            <Label htmlFor="json" className="!text-neutral3 text-ui-sm">
              JSON
            </Label>
          </div>
        </div>
      </RadioGroup>

      <div
        className={cn({
          'opacity-50 pointer-events-none': isSubmitLoading,
        })}
      >
        {type === 'simple' && isProcessorWorkflow ? (
          <SimpleProcessorInput
            schema={schema}
            defaultValues={defaultValues}
            isSubmitLoading={isSubmitLoading}
            submitButtonLabel={submitButtonLabel}
            onSubmit={onSubmit}
            withoutSubmit={withoutSubmit}
          >
            {children}
          </SimpleProcessorInput>
        ) : type === 'form' ? (
          <DynamicForm
            schema={schema}
            defaultValues={defaultValues}
            isSubmitLoading={isSubmitLoading}
            submitButtonLabel={submitButtonLabel}
            onSubmit={withoutSubmit ? undefined : onSubmit}
          >
            {children}
          </DynamicForm>
        ) : (
          <JSONInput
            schema={schema}
            defaultValues={defaultValues}
            isSubmitLoading={isSubmitLoading}
            submitButtonLabel={submitButtonLabel}
            onSubmit={onSubmit}
            withoutSubmit={withoutSubmit}
          >
            {children}
          </JSONInput>
        )}
      </div>
    </div>
  );
};

const JSONInput = ({
  schema,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  withoutSubmit,
  children,
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
    } catch (e) {
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

      <CodeEditor data={data} onChange={setInputData} />

      {children}

      {withoutSubmit ? null : (
        <Button variant="light" onClick={handleSubmit} className="w-full" size="lg">
          {isSubmitLoading ? <Loader2 className="animate-spin" /> : submitButtonLabel}
        </Button>
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

const SimpleProcessorInput = ({
  schema,
  defaultValues,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  withoutSubmit,
  children,
}: WorkflowInputDataProps) => {
  const [message, setMessage] = useState('Hello, this is a test message.');
  const [phase, setPhase] = useState('input');
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
    } catch (e) {
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
        <Select value={phase} onValueChange={setPhase}>
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
        <Txt variant="ui-xs" className="text-icon4">
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
          className="w-full bg-transparent border border-border1 rounded-md p-3 text-ui-sm text-neutral6 placeholder:text-neutral3 focus:outline-none focus:ring-2 focus:ring-accent1"
        />
      </div>

      {children}

      {withoutSubmit ? null : (
        <Button variant="light" onClick={handleSubmit} className="w-full" size="lg">
          {isSubmitLoading ? <Loader2 className="animate-spin" /> : submitButtonLabel}
        </Button>
      )}
    </div>
  );
};

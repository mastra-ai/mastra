import { DynamicForm } from '@/lib/form';
import { Button } from '@/ds/components/Button/Button';
import { CodeEditor, useCodemirrorTheme } from '@/ds/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Label } from '@/ds/components/Label';
import { Loader2 } from 'lucide-react';

import { ZodSchema } from 'zod';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';

export interface WorkflowInputDataProps {
  schema: ZodSchema;
  defaultValues?: any;
  isSubmitLoading: boolean;
  submitButtonLabel: string;
  onSubmit: (data: any) => void;
  withoutSubmit?: boolean;
  children?: React.ReactNode;
}

export const WorkflowInputData = ({
  schema,
  defaultValues,
  withoutSubmit,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
  children,
}: WorkflowInputDataProps) => {
  const [type, setType] = useState<'json' | 'form'>('form');

  return (
    <div>
      <RadioGroup
        disabled={isSubmitLoading}
        value={type}
        onValueChange={value => setType(value as 'json' | 'form')}
        className="pb-4"
      >
        <div className="flex flex-row gap-4">
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
        {type === 'form' ? (
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

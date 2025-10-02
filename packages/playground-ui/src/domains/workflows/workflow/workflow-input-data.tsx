import { DynamicForm } from '@/components/dynamic-form';
import { Button } from '@/ds/components/Button/Button';
import { useCodemirrorTheme } from '@/components/ui/syntax-highlighter';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { jsonLanguage } from '@codemirror/lang-json';
import { CopyButton } from '@/components/ui/copy-button';
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
}

export const WorkflowInputData = ({
  schema,
  defaultValues,
  withoutSubmit,
  isSubmitLoading,
  submitButtonLabel,
  onSubmit,
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
            <Label htmlFor="form" className="!text-icon3 text-ui-sm">
              Form
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="json" id="json" />
            <Label htmlFor="json" className="!text-icon3 text-ui-sm">
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
          />
        ) : (
          <JSONInput
            schema={schema}
            defaultValues={defaultValues}
            isSubmitLoading={isSubmitLoading}
            submitButtonLabel={submitButtonLabel}
            onSubmit={onSubmit}
            withoutSubmit={withoutSubmit}
          />
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

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="border-sm border-accent2 rounded-lg p-2">
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

      <SyntaxHighlighter data={inputData} onChange={setInputData} />

      {withoutSubmit ? null : (
        <Button variant="light" onClick={handleSubmit} className="w-full" size="lg">
          {isSubmitLoading ? <Loader2 className="animate-spin" /> : submitButtonLabel}
        </Button>
      )}
    </div>
  );
};

const SyntaxHighlighter = ({ data, onChange }: { data: string; onChange?: (data: string) => void }) => {
  const theme = useCodemirrorTheme();

  return (
    <div className="rounded-md bg-[#1a1a1a] p-1 font-mono">
      <CopyButton content={data} className="absolute top-2 right-2 z-10" />
      <CodeMirror value={data} theme={theme} extensions={[jsonLanguage]} onChange={onChange} />
    </div>
  );
};

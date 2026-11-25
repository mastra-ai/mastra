import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { useRef, useState } from 'react';
import { useStudioConfig } from '../context/studio-config-state';
import type { StudioConfig } from '../types';
import type { HeaderListFormItem } from './header-list-form';
import { HeaderListForm } from './header-list-form';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
  onSave?: () => void;
  onCancel?: () => void;
  onReset?: () => void;
}

export const StudioConfigForm = ({ initialConfig, onSave, onCancel, onReset }: StudioConfigFormProps) => {
  const { setConfig } = useStudioConfig();
  // Rows keep an id so removing one doesn't hand its inputs to the next.
  const nextHeaderId = useRef(0);
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() => {
    if (!initialConfig) return [];

    return Object.entries(initialConfig.headers).map(([name, value]) => ({ id: nextHeaderId.current++, name, value }));
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const url = readFormText(formData, 'url').trim();
    const rawApiPrefix = readFormText(formData, 'apiPrefix').trim();
    const apiPrefix = rawApiPrefix.length ? rawApiPrefix : undefined;

    const formHeaders: Record<string, string> = {};
    for (let headerIndex = 0; headerIndex < headers.length; headerIndex++) {
      const headerName = readFormText(formData, `headers.${headerIndex}.name`);
      const headerValue = readFormText(formData, `headers.${headerIndex}.value`);
      formHeaders[headerName] = headerValue;
    }

    setConfig({ headers: formHeaders, baseUrl: url, apiPrefix });
    onSave?.();
  };

  const handleAddHeader = (header: HeaderListFormItem) => {
    setHeaders(prev => [...prev, { ...header, id: nextHeaderId.current++ }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Form onSubmit={handleSubmit} className="gap-6">
        <Field>
          <FieldLabel required>Mastra instance URL</FieldLabel>
          <Input
            name="url"
            placeholder="http://localhost:4111"
            spellCheck={false}
            required
            defaultValue={initialConfig?.baseUrl}
          />
          <FieldError />
        </Field>

        <Field>
          <FieldLabel>API prefix</FieldLabel>
          <Input
            name="apiPrefix"
            placeholder="/api (default)"
            spellCheck={false}
            defaultValue={initialConfig?.apiPrefix ?? ''}
          />
        </Field>

        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="primary" size="lg">
            Connect
          </Button>
          {(onCancel || onReset) && (
            <div className="flex flex-wrap justify-center gap-2">
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              {onReset && (
                <Button type="button" variant="ghost" onClick={onReset}>
                  Reset to default
                </Button>
              )}
            </div>
          )}
        </div>
      </Form>
    </TooltipProvider>
  );
};

function readFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') throw new Error(`Missing text field: ${name}`);
  return value;
}

import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { toast } from '@mastra/playground-ui/utils/toast';
import { SaveIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useStudioConfig } from '../context/studio-config-state';
import type { StudioConfig } from '../types';
import type { HeaderListFormItem } from './header-list-form';
import { HeaderListForm } from './header-list-form';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
  onSave?: () => void;
}

export const StudioConfigForm = ({ initialConfig, onSave }: StudioConfigFormProps) => {
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
    const url = readFormText(formData, 'url');
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
    toast.success('Configuration saved');
  };

  const handleAddHeader = (header: HeaderListFormItem) => {
    setHeaders(prev => [...prev, { ...header, id: nextHeaderId.current++ }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const connectionFields = [
    {
      name: 'url',
      label: 'Mastra instance URL',
      placeholder: 'e.g: http://localhost:4111',
      required: true,
      defaultValue: initialConfig?.baseUrl,
    },
    {
      name: 'apiPrefix',
      label: 'API prefix',
      placeholder: 'e.g: /api (default)',
      defaultValue: initialConfig?.apiPrefix || '',
    },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <Form onSubmit={handleSubmit} className="gap-6">
        {connectionFields.map(({ label, ...field }) => (
          <Field key={field.name}>
            <FieldLabel required={field.required}>{label}</FieldLabel>
            <Input {...field} />
            <FieldError />
          </Field>
        ))}
        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />

        <Button type="submit" className="mt-4 ml-auto" icon={<SaveIcon />}>
          Save configuration
        </Button>
      </Form>
    </TooltipProvider>
  );
};

function readFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') throw new Error(`Missing text field: ${name}`);
  return value;
}

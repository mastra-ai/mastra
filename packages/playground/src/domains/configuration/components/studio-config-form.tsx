import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsGroup,
  SettingsListHeader,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlusIcon, SaveIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useStudioConfig } from '../context/studio-config-state';
import type { StudioConfig } from '../types';
import type { HeaderListFormItem } from './header-list-form';
import { HeaderFieldsRow, HeaderListForm } from './header-list-form';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
  onSave?: () => void;
  variant?: 'default' | 'factory';
}

export const StudioConfigForm = ({ initialConfig, onSave, variant = 'default' }: StudioConfigFormProps) => {
  const { setConfig } = useStudioConfig();
  // Each header keeps an id so removing one doesn't hand its inputs to the next. A counter, not
  // `crypto.randomUUID`, which is missing when Studio is served over plain http.
  const nextHeaderId = useRef(0);
  const [headers, setHeaders] = useState<Array<HeaderListFormItem & { id: number }>>(() => {
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
    const id = nextHeaderId.current++;
    setHeaders(prev => [...prev, { ...header, id }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const connectionFields = [
    {
      name: 'url',
      label: 'Mastra instance URL',
      description: 'The server this studio talks to.',
      placeholder: 'e.g: http://localhost:4111',
      required: true,
      defaultValue: initialConfig?.baseUrl,
    },
    {
      name: 'apiPrefix',
      label: 'API prefix',
      description: 'Path in front of every API route.',
      placeholder: 'e.g: /api (default)',
      defaultValue: initialConfig?.apiPrefix || '',
    },
  ];

  const saveButton = (
    <Button type="submit" className={variant === 'factory' ? 'ml-auto' : 'mt-4 ml-auto'} icon={<SaveIcon />}>
      Save configuration
    </Button>
  );

  const addHeaderButton = (
    <Button type="button" size="sm" icon={<PlusIcon />} onClick={() => handleAddHeader({ name: '', value: '' })}>
      Add header
    </Button>
  );

  if (variant === 'factory') {
    return (
      <TooltipProvider delayDuration={0}>
        <Form onSubmit={handleSubmit} className="gap-7">
          <SettingsGroup>
            <SettingsTitle info="The Mastra instance the studio talks to, and the path in front of its API routes.">
              Mastra connection
            </SettingsTitle>
            <SettingsContainer>
              {connectionFields.map(({ label, description, ...field }) => (
                <SettingsRow key={field.name} label={label} description={description}>
                  <Input {...field} />
                </SettingsRow>
              ))}
            </SettingsContainer>
          </SettingsGroup>

          <SettingsGroup>
            <SettingsTitle info="Sent with every request the studio makes, for auth or routing.">
              Request headers
            </SettingsTitle>
            <SettingsContainer>
              {headers.length === 0 ? (
                <SettingsEmptyRow action={addHeaderButton}>No request headers</SettingsEmptyRow>
              ) : (
                <>
                  <SettingsListHeader action={addHeaderButton}>
                    {headers.length === 1 ? '1 header' : `${headers.length} headers`}
                  </SettingsListHeader>
                  {headers.map((header, index) => (
                    <HeaderFieldsRow
                      key={header.id}
                      index={index}
                      header={header}
                      onRemove={() => handleRemoveHeader(index)}
                    />
                  ))}
                </>
              )}
            </SettingsContainer>
          </SettingsGroup>

          {saveButton}
        </Form>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Form onSubmit={handleSubmit} className="gap-6">
        {connectionFields.map(({ label, description: _description, ...field }) => (
          <Field key={field.name}>
            <FieldLabel required={field.required}>{label}</FieldLabel>
            <Input {...field} />
            <FieldError />
          </Field>
        ))}
        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />
        {saveButton}
      </Form>
    </TooltipProvider>
  );
};

function readFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') throw new Error(`Missing text field: ${name}`);
  return value;
}

import { Button } from '@mastra/playground-ui/components/Button';
import { TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/utils/toast';
import { SaveIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useStudioConfig } from '../context/studio-config-state';
import type { StudioConfig } from '../types';
import type { HeaderListFormItem } from './header-list-form';
import { HeaderListForm } from './header-list-form';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
  onSave?: () => void;
  variant?: 'default' | 'factory';
}

export const StudioConfigForm = ({ initialConfig, onSave, variant = 'default' }: StudioConfigFormProps) => {
  const isFactoryLayout = variant === 'factory';
  const FieldsContainer = isFactoryLayout ? SettingsContainer : Fragment;
  const { setConfig } = useStudioConfig();
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() => {
    if (!initialConfig) return [];

    return Object.entries(initialConfig.headers).map(([name, value]) => ({ name, value }));
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
    setHeaders(prev => [...prev, header]);
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

  const headersEditor = (
    <HeaderListForm
      headers={headers}
      onAddHeader={handleAddHeader}
      onRemoveHeader={handleRemoveHeader}
      showHeading={!isFactoryLayout}
    />
  );

  return (
    <TooltipProvider delayDuration={0}>
      <form onSubmit={handleSubmit} className={isFactoryLayout ? 'flex flex-col gap-4' : 'space-y-6'}>
        <FieldsContainer>
          {connectionFields.map(({ label, ...field }) => {
            if (isFactoryLayout) {
              return (
                <SettingsRow key={field.name} label={label} htmlFor={`input-${field.name}`}>
                  <Input {...field} id={`input-${field.name}`} className="w-full lg:max-w-96" />
                </SettingsRow>
              );
            }

            return <TextFieldBlock key={field.name} label={label} {...field} />;
          })}
          {isFactoryLayout ? (
            <SettingsRow label="Headers">
              <div className="w-full lg:max-w-96">{headersEditor}</div>
            </SettingsRow>
          ) : (
            headersEditor
          )}
        </FieldsContainer>

        <Button type="submit" className={isFactoryLayout ? 'ml-auto' : 'mt-10! ml-auto'}>
          <SaveIcon />
          Save Configuration
        </Button>
      </form>
    </TooltipProvider>
  );
};

function readFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') throw new Error(`Missing text field: ${name}`);
  return value;
}

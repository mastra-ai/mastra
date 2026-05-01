import { Button, TextFieldBlock, TooltipProvider, toast } from '@mastra/playground-ui';
import { SaveIcon } from 'lucide-react';
import { useState } from 'react';
import { useStudioConfig } from '../context/studio-config-context';
import type { StudioConfig } from '../types';
import type { HeaderListFormItem } from './header-list-form';
import { HeaderListForm } from './header-list-form';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
  onSave?: () => void;
}

export const StudioConfigForm = ({ initialConfig, onSave }: StudioConfigFormProps) => {
  const { setConfig } = useStudioConfig();
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() => {
    if (!initialConfig) return [];

    return Object.entries(initialConfig.headers).map(([name, value]) => ({ name, value }));
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url') as string;
    const rawApiPrefix = ((formData.get('apiPrefix') as string) ?? '').trim();
    const apiPrefix = rawApiPrefix.length ? rawApiPrefix : undefined;

    const formHeaders: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const headerName = formData.get(`headers.${i}.name`) as string;
      const headerValue = formData.get(`headers.${i}.value`) as string;
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

  return (
    <TooltipProvider delayDuration={0}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextFieldBlock
          name="url"
          label="Mastra instance URL"
          placeholder="e.g: http://localhost:4111"
          required
          defaultValue={initialConfig?.baseUrl}
        />

        <TextFieldBlock
          name="apiPrefix"
          label="API prefix"
          placeholder="e.g: /api (default)"
          defaultValue={initialConfig?.apiPrefix || ''}
        />

        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />

        <Button type="submit" className="mt-10! ml-auto">
          <SaveIcon />
          Save Configuration
        </Button>
      </form>
    </TooltipProvider>
  );
};

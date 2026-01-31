import { useState } from 'react';
import { HeaderListForm, HeaderListFormItem } from './header-list-form';
import { useStudioConfig } from '../context/studio-config-context';
import { StudioConfig } from '../types';
import { Link2 } from 'lucide-react';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { toast } from 'sonner';
import { InputField } from '@/ds/components/FormFields';

export interface StudioConfigFormProps {
  initialConfig?: StudioConfig;
}

export const StudioConfigForm = ({ initialConfig }: StudioConfigFormProps) => {
  const { setConfig } = useStudioConfig();
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() => {
    if (!initialConfig) return [];

    return Object.entries(initialConfig.headers).map(([name, value]) => ({ name, value }));
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url') as string;

    const formHeaders: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const headerName = formData.get(`headers.${i}.name`) as string;
      const headerValue = formData.get(`headers.${i}.value`) as string;
      formHeaders[headerName] = headerValue;
    }

    setConfig({ headers: formHeaders, baseUrl: url });
    toast.success('Configuration saved');
  };

  const handleAddHeader = (header: HeaderListFormItem) => {
    setHeaders(prev => [...prev, header]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        name="url"
        label="Mastra instance URL"
        placeholder="e.g: http://localhost:4111"
        required
        defaultValue={initialConfig?.baseUrl}
      />

      <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />
      <Button type="submit" variant="light" className="w-full" size="lg">
        <Icon>
          <Link2 />
        </Icon>
        Set Configuration
      </Button>
    </form>
  );
};

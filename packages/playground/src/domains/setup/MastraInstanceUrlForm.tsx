import { Button, Icon, InputField, LogoWithoutText } from '@mastra/playground-ui';
import { Link2 } from 'lucide-react';
import { HeaderListForm } from './HeaderListForm';
import { HeaderConfig, MastraInstanceConfig } from './MastraInstanceUrlContext';
import { useState } from 'react';

export interface MastraInstanceUrlFormProps {
  onSetInstanceConfig: (config: MastraInstanceConfig) => void;
  initialHeaders: HeaderConfig[];
}

export const MastraInstanceUrlForm = ({ onSetInstanceConfig, initialHeaders }: MastraInstanceUrlFormProps) => {
  const [headers, setHeaders] = useState<HeaderConfig[]>(initialHeaders);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url') as string;

    const formHeaders: HeaderConfig[] = [];
    for (let i = 0; i < headers.length; i++) {
      const headerName = formData.get(`headers.${i}.name`) as string;
      const headerValue = formData.get(`headers.${i}.value`) as string;
      formHeaders.push({ name: headerName, value: headerValue });
    }

    onSetInstanceConfig({ url, headers: formHeaders });
  };

  const handleAddHeader = (header: HeaderConfig) => {
    setHeaders([...headers, header]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-surface1">
      <LogoWithoutText className="size-32" />
      <form onSubmit={handleSubmit} className="max-w-lg w-full mx-auto px-4 pt-4 space-y-4">
        <InputField name="url" label="Mastra instance URL" placeholder="e.g: http://localhost:4111" required />

        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />

        <Button type="submit" variant="light" className="w-full" size="lg">
          <Icon>
            <Link2 />
          </Icon>
          Set Configuration
        </Button>
      </form>
    </div>
  );
};

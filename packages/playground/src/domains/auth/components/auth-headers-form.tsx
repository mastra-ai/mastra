import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { toast } from '@mastra/playground-ui/utils/toast';
import { SaveIcon } from 'lucide-react';
import { useState } from 'react';
import type { HeaderListFormItem } from '@/domains/configuration/components/header-list-form';
import { HeaderListForm } from '@/domains/configuration/components/header-list-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

/**
 * Compact header editor for the blocked "Authentication Required" screen.
 *
 * When auth is enabled but the provider exposes no login method, the user must
 * save an Authorization header before any request succeeds. This form edits
 * only the headers of the studio config; the stored base URL and API prefix
 * pass through unchanged.
 */
export const AuthHeadersForm = () => {
  const { baseUrl, headers: storedHeaders, apiPrefix, setConfig } = useStudioConfig();
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() =>
    Object.entries(storedHeaders).map(([name, value]) => ({ name, value })),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const formHeaders: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const headerName = formData.get(`headers.${i}.name`);
      const headerValue = formData.get(`headers.${i}.value`);
      if (typeof headerName !== 'string' || typeof headerValue !== 'string') continue;
      formHeaders[headerName] = headerValue;
    }

    setConfig({ headers: formHeaders, baseUrl, apiPrefix });
    toast.success('Headers saved');
  };

  const handleAddHeader = (header: HeaderListFormItem) => {
    setHeaders(prev => [...prev, header]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 text-left">
        <HeaderListForm headers={headers} onAddHeader={handleAddHeader} onRemoveHeader={handleRemoveHeader} />

        <Button type="submit" className="ml-auto">
          <SaveIcon />
          Save Headers
        </Button>
      </form>
    </TooltipProvider>
  );
};

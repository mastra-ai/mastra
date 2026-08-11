import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { SaveIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const queryClient = useQueryClient();
  const [saveCount, setSaveCount] = useState(0);
  const [headers, setHeaders] = useState<HeaderListFormItem[]>(() =>
    Object.entries(storedHeaders).map(([name, value]) => ({ name, value })),
  );

  // Auth capabilities and permission patterns are cached from the previous
  // headers, so the auth gate keeps the user out until they are refetched. The
  // effect runs after the saved config reaches the Mastra client, so the
  // refetch carries the new headers and no page reload is needed.
  //
  // The invalidation is deferred one tick because React runs child effects
  // first. This form is a child of the auth gate, so at effect time the gate's
  // query observer still holds the query function built from the previous
  // client. One tick later the observer has adopted the new headers.
  useEffect(() => {
    if (saveCount === 0) return;

    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'capabilities'] });
      queryClient.invalidateQueries({ queryKey: ['permission-patterns'] });
    }, 0);

    return () => clearTimeout(timeout);
  }, [saveCount, queryClient]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const formHeaders: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const headerName = formData.get(`headers.${i}.name`) as string;
      const headerValue = formData.get(`headers.${i}.value`) as string;
      formHeaders[headerName] = headerValue;
    }

    setConfig({ headers: formHeaders, baseUrl, apiPrefix });
    setSaveCount(count => count + 1);
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

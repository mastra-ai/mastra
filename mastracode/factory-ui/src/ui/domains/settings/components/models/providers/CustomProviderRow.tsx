import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MoreHorizontal, ServerCog } from 'lucide-react';

import type { CustomProviderInfo } from '../../../../../../api/types';
import { useRemoveCustomProvider } from '../../../../../../hooks/use-custom-providers';
import type { CredentialScope } from '../../provider-credential';

const REMOVING_STATUS: StatusPresentation = {
  label: 'Removing…',
  tone: 'progress',
  description: 'Deleting the custom endpoint',
};

function modelsStatus(provider: CustomProviderInfo): StatusPresentation {
  const count = provider.models.length;
  return {
    label: `${count} model${count === 1 ? '' : 's'}`,
    tone: count > 0 ? 'success' : 'neutral',
    description: provider.hasApiKey ? 'Custom endpoint with a saved API key' : 'Custom endpoint without an API key',
  };
}

/** A custom OpenAI-compatible endpoint in a provider list, next to the built-in providers. */
export function CustomProviderRow({
  provider,
  requestScope,
  disabled,
  onEdit,
}: {
  provider: CustomProviderInfo;
  requestScope: CredentialScope | undefined;
  disabled: boolean;
  onEdit: () => void;
}) {
  const removeMutation = useRemoveCustomProvider();

  const remove = () => {
    removeMutation.mutate(
      { id: provider.id, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to remove the endpoint') },
    );
  };

  return (
    <li className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
      <ServerCog aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <Txt as="span" variant="caption" className="max-w-[45%] shrink-0 truncate">
        {provider.name}
      </Txt>
      <Txt as="span" variant="meta" tone="muted" className="min-w-0 flex-1 truncate">
        {provider.url}
      </Txt>
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        <Status presentation={removeMutation.isPending ? REMOVING_STATUS : modelsStatus(provider)} />
      </Txt>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${provider.name} actions`}
              disabled={disabled || removeMutation.isPending}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onClick={onEdit}>Edit</DropdownMenu.Item>
          <DropdownMenu.Item onClick={remove}>Remove</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </li>
  );
}

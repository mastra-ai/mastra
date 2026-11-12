import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { MoreHorizontal } from 'lucide-react';

import type { CustomProviderInfo } from '../../../../../../api/types';
import { useRemoveCustomProvider } from '../../../../../../hooks/use-custom-providers';
import { ConnectedRow, CustomEndpointIcon } from './ProviderRows';

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
  disabled,
  onEdit,
}: {
  provider: CustomProviderInfo;
  disabled: boolean;
  onEdit: () => void;
}) {
  const removeMutation = useRemoveCustomProvider();

  const remove = () => {
    removeMutation.mutate(
      { id: provider.id, scope: provider.scope },
      { onError: error => toast.error(error.message || 'Failed to remove the endpoint') },
    );
  };

  return (
    <ConnectedRow
      icon={<CustomEndpointIcon />}
      title={provider.name}
      detail={provider.url}
      status={removeMutation.isPending ? REMOVING_STATUS : modelsStatus(provider)}
    >
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
    </ConnectedRow>
  );
}

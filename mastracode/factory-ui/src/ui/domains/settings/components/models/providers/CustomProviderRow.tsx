import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

import type { CustomProviderInfo } from '../../../../../../api/types';
import { useCheckCustomProvider, useRemoveCustomProvider } from '../../../../../../hooks/use-custom-providers';
import { ConnectedRow, CustomEndpointIcon } from './ProviderRows';

const REMOVING_STATUS: StatusPresentation = {
  label: 'Removing…',
  tone: 'progress',
  description: 'Deleting the custom endpoint',
};

const TESTING_STATUS: StatusPresentation = {
  label: 'Testing…',
  tone: 'progress',
  description: 'Calling the endpoint to list its models',
};

/** "N models", counting the models configured on the endpoint. */
function modelCount(provider: CustomProviderInfo): string {
  const count = provider.models.length;
  return `${count} model${count === 1 ? '' : 's'}`;
}

/** The row's status: a refused URL first, then the last connection test, which saving new settings clears. */
function endpointStatus(provider: CustomProviderInfo): StatusPresentation {
  if (provider.urlProblem) {
    return {
      label: 'URL not allowed',
      tone: 'error',
      description: `${provider.urlProblem} Edit it to use its models.`,
    };
  }
  if (!provider.lastCheck) {
    return {
      label: 'Not verified',
      tone: 'neutral',
      description: 'No connection test since these settings were saved',
    };
  }
  if (!provider.lastCheck.ok) {
    return {
      label: 'Check failed',
      tone: 'error',
      description: provider.lastCheck.message ?? 'The last connection test failed',
    };
  }
  return { label: modelCount(provider), tone: 'success', description: 'Passed the last connection test' };
}

/** The status shown while a row action runs, else the endpoint's own. */
function rowStatus(provider: CustomProviderInfo, { removing, testing }: { removing: boolean; testing: boolean }) {
  if (removing) return REMOVING_STATUS;
  if (testing) return TESTING_STATUS;
  return endpointStatus(provider);
}

/** The URL, and under it why the last connection test failed, so the reason is readable without opening anything. */
function rowDetail(provider: CustomProviderInfo) {
  const failure = !provider.urlProblem && provider.lastCheck?.ok === false ? provider.lastCheck.message : undefined;
  if (!failure) return provider.url;
  return (
    <>
      {provider.url}
      {/* Clamped so a long upstream message can't stretch the row; the status description keeps the full text. */}
      <span className="line-clamp-2">{failure}</span>
    </>
  );
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
  const checkMutation = useCheckCustomProvider();
  const pending = removeMutation.isPending || checkMutation.isPending;

  const remove = () => {
    removeMutation.mutate(
      { id: provider.id, scope: provider.scope },
      { onError: error => toast.error(error.message || 'Failed to remove the endpoint') },
    );
  };

  /** Tests the saved endpoint as stored. The server records the result, and a toast reports it. */
  const test = () => {
    checkMutation.mutate(
      { previousId: provider.id, scope: provider.scope },
      {
        onSuccess: ({ check }) => {
          if (check.models.ok) {
            const count = check.models.models.length;
            toast.success(`${provider.name} answered and lists ${count} model${count === 1 ? '' : 's'}.`);
          } else {
            toast.error(`${provider.name} failed the connection test. ${check.models.failure.message}`);
          }
        },
        onError: error => toast.error(error.message || "Couldn't test the endpoint."),
      },
    );
  };

  return (
    <ConnectedRow
      icon={<CustomEndpointIcon />}
      title={provider.name}
      detail={rowDetail(provider)}
      status={rowStatus(provider, { removing: removeMutation.isPending, testing: checkMutation.isPending })}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${provider.name} actions`}
              disabled={disabled || pending}
            >
              <IconDotGrid1x3Horizontal />
            </Button>
          }
        />
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onClick={test} disabled={Boolean(provider.urlProblem)}>
            <IconPlay /> Test connection
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={onEdit}>
            <IconPencil /> Edit
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="destructive" onClick={remove}>
            <TrashIcon /> Remove
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </ConnectedRow>
  );
}

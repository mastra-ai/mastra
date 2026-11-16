import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { HolderBadge } from './ModelCredential';
import { useModelCredential } from '../../hooks/useModelCredential';
import { IconKey2 } from '@mastra/playground-ui/icons/central/IconKey2';

/** Provider icon for the trigger, with the credential holder badged on its corner. */
export function ModelProviderMark({
  modelId,
  provider,
}: {
  modelId: string | undefined;
  provider: string | undefined;
}) {
  const credential = useModelCredential(modelId);
  const shownProvider = credential?.provider ?? provider;
  if (!shownProvider) return null;
  return (
    <span className="relative flex shrink-0">
      <ProviderBrandIcon provider={shownProvider} fallback={<IconKey2 className="size-icon-sm" />} />
      {credential ? (
        <span className="absolute -right-1.5 -bottom-1.5 scale-75">
          <HolderBadge holder={credential.holder} />
        </span>
      ) : null}
    </span>
  );
}

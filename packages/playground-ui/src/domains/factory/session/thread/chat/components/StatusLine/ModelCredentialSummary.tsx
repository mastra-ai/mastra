import { useModelCredential } from '../../hooks/useModelCredential';
import { HolderBadge } from './ModelCredential';
import { ProviderBrandIcon } from '@/domains/factory';
import { IconKey2 } from '@/ds/icons/central/IconKey2';

/** The credential the selected model runs on, shown at the top of the picker. */
export function ModelCredentialSummary({ modelId }: { modelId: string | undefined }) {
  const credential = useModelCredential(modelId);
  if (!credential) return null;
  return (
    <div className="flex flex-col gap-1 px-3 py-2 text-caption">
      <div className="flex min-w-0 items-center gap-1.5">
        <ProviderBrandIcon provider={credential.provider} fallback={<IconKey2 className="size-icon-sm" />} />
        <span className="truncate font-medium text-foreground">{credential.credential}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <HolderBadge holder={credential.holder} />
        <span className="truncate">{credential.holderDescription}</span>
      </div>
      {credential.warning ? <span className="text-warning-foreground">{credential.warning}</span> : null}
    </div>
  );
}

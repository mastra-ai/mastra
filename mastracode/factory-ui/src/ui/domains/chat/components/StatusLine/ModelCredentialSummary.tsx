import { KeyRound } from 'lucide-react';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { HolderBadge } from './ModelCredential';
import { useModelCredential } from '../../hooks/useModelCredential';

/** The credential the selected model runs on, shown at the top of the picker. */
export function ModelCredentialSummary({ modelId }: { modelId: string | undefined }) {
  const credential = useModelCredential(modelId);
  if (!credential) return null;
  return (
    <div className="text-caption flex flex-col gap-1 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <ProviderBrandIcon provider={credential.provider} fallback={<KeyRound className="size-3.5" />} />
        <span className="text-foreground truncate font-medium">{credential.credential}</span>
      </div>
      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5">
        <HolderBadge holder={credential.holder} />
        <span className="truncate">{credential.holderDescription}</span>
      </div>
      {credential.warning ? <span className="text-warning-foreground">{credential.warning}</span> : null}
    </div>
  );
}

import { BlocksIcon } from 'lucide-react';
import { useState } from 'react';

export interface ProviderLogoProps {
  logoUrl?: string | null;
}

/** Provider logo from the platform catalog, with a generic icon fallback. */
export function ProviderLogo({ logoUrl }: ProviderLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="border-border1 bg-surface3 grid size-7 shrink-0 place-items-center rounded-md border p-1">
      {logoUrl && !failed ? (
        <img src={logoUrl} alt="" className="size-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <BlocksIcon aria-hidden className="text-icon3 size-4" />
      )}
    </span>
  );
}

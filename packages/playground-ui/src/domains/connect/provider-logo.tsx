import { useState } from 'react';
import { IconBlocks } from '@/ds/icons/central/IconBlocks';

export interface ProviderLogoProps {
  logoUrl?: string | null;
}

/** Provider logo from the platform catalog, with a generic icon fallback. */
export function ProviderLogo({ logoUrl }: ProviderLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span className="grid size-8 shrink-0 place-items-center p-1.5">
      {logoUrl && failedSrc !== logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain" onError={() => setFailedSrc(logoUrl)} />
      ) : (
        <IconBlocks aria-hidden className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}

import { useState } from 'react';
import { IconBlocks } from '@/ds/icons/central/IconBlocks';

export interface ProviderLogoProps {
  logoUrl?: string | null;
  /** A single-color logo drawn in black: shown in the text color, so it stays visible in dark mode. */
  tinted?: boolean;
}

/** Provider logo from the platform catalog, with a generic icon fallback. */
export function ProviderLogo({ logoUrl, tinted = false }: ProviderLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span className="grid size-8 shrink-0 place-items-center p-1.5">
      {logoUrl && failedSrc !== logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={tinted ? 'size-full object-contain brightness-0 dark:invert' : 'size-full object-contain'}
          onError={() => setFailedSrc(logoUrl)}
        />
      ) : (
        <IconBlocks aria-hidden className="size-icon-md text-muted-foreground" />
      )}
    </span>
  );
}

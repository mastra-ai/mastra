import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box } from 'lucide-react';
import type { ReactNode } from 'react';

import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';

/** A provider in the Add provider and speech-to-text drawers' lists. */
export function ProviderOptionRow({
  provider,
  label,
  children,
}: {
  provider: string;
  label: string | undefined;
  children: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2 pr-2 pl-3">
      <ProviderBrandIcon provider={provider} fallback={<Box className="text-muted-foreground size-4" />} />
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="caption" className="truncate">
          {providerDisplayName(provider)}
        </Txt>
        {label && (
          <Txt as="span" variant="meta" tone="muted">
            {label}
          </Txt>
        )}
      </span>
      {children}
    </li>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { IconBox } from '@mastra/playground-ui/icons/central/IconBox';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import type { ReactNode } from 'react';

import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';

export function ProviderRows({
  children,
  addDisabled,
  onAdd,
}: {
  children: ReactNode;
  addDisabled: boolean;
  onAdd: () => void;
}) {
  return (
    <ul className="divide-border divide-y">
      {children}
      <li>
        <Button variant="ghost" size="sm" className="h-10 w-full justify-start" disabled={addDisabled} onClick={onAdd}>
          <IconPlusLarge aria-hidden="true" />
          Add provider
        </Button>
      </li>
    </ul>
  );
}

export function ProviderRowsSkeleton() {
  return <SettingsSkeleton label="Loading providers" variant="item" />;
}

export function ProviderOptionRow({
  provider,
  label,
  children,
}: {
  provider: string;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2 pr-2 pl-3">
      <ProviderBrandIcon provider={provider} fallback={<IconBox className="text-muted-foreground size-4" />} />
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

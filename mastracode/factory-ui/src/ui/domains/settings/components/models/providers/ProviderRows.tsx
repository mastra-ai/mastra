import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../../../ui/SkeletonRows';
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
    <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {children}
      <li>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full justify-start rounded-none pl-3"
          disabled={addDisabled}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" />
          Add provider
        </Button>
      </li>
    </ul>
  );
}

export function ProviderRowsSkeleton() {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <SkeletonRows label="Loading providers" rows={3} className="divide-border gap-0 divide-y">
        <div aria-hidden className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
          <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-28 max-w-full motion-reduce:before:animate-none" />
          </div>
          <Skeleton className="h-3 w-20 motion-reduce:before:animate-none" />
          <Skeleton className="size-control-sm shrink-0 rounded-full motion-reduce:before:animate-none" />
        </div>
      </SkeletonRows>
    </div>
  );
}

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

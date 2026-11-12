import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box, Plus, ServerCog } from 'lucide-react';
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

/** The row's name on one line, and a detail that wraps rather than hiding a URL or a balance. */
function RowTitle({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <Txt as="span" variant="caption" className="truncate">
        {title}
      </Txt>
      {detail && (
        <Txt as="span" variant="meta" tone="muted" className="break-words">
          {detail}
        </Txt>
      )}
    </span>
  );
}

/** A provider connected at a scope in a provider list: what it is, its status and its actions. */
export function ConnectedRow({
  icon,
  title,
  detail,
  status,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  status: StatusPresentation;
  /** The row's actions. A row without any keeps the column so statuses line up. */
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
      {icon}
      <RowTitle title={title} detail={detail} />
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        <Status presentation={status} />
      </Txt>
      {children ?? <span aria-hidden="true" className="size-control-sm shrink-0" />}
    </li>
  );
}

/** One choice in the Add provider drawer: what it is, an optional note, and the ways to add it. */
export function OptionRow({
  icon,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2 pr-2 pl-3">
      {icon}
      <RowTitle title={title} detail={detail} />
      {children}
    </li>
  );
}

export function ProviderIcon({ provider }: { provider: string }) {
  return <ProviderBrandIcon provider={provider} fallback={<Box className="text-muted-foreground size-4" />} />;
}

export function CustomEndpointIcon() {
  return <ServerCog aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />;
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
    <OptionRow icon={<ProviderIcon provider={provider} />} title={providerDisplayName(provider)} detail={label}>
      {children}
    </OptionRow>
  );
}

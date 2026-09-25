import type { DatasetItem } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing, transitions } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { BanIcon, EqualIcon, PenIcon, PlusIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetCompareVersionsListProps {
  datasetId: string;
  versionA: number;
  versionB: number;
  allItems: Array<{ id: string; createdAt: Date }>;
  itemsAMap: Map<string, DatasetItem>;
  itemsBMap: Map<string, DatasetItem>;
}

const versionInfoConfig = {
  added: {
    badgeVariant: 'blue' as const,
    borderColor: 'border-blue-900',
    icon: <PlusIcon />,
    tooltip: 'Added in this version',
  },
  changed: {
    badgeVariant: 'yellow' as const,
    borderColor: 'border-yellow-900',
    icon: <PenIcon />,
    tooltip: 'Changed in this version',
  },
  same: {
    badgeVariant: 'green' as const,
    borderColor: 'border-green-900',
    icon: <EqualIcon />,
    tooltip: 'Same in both versions',
  },
};

type VersionInfoVariant = keyof typeof versionInfoConfig;
type VersionStatus = 'same' | 'changed' | 'added' | 'removed';

function EmptyCell({ red = false, tooltip }: { red?: boolean; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        role="img"
        tabIndex={0}
        aria-label={tooltip}
        className="rounded focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:outline-solid"
      >
        <BanIcon
          className={cn('h-5 w-5 text-muted-foreground/40', {
            'text-red-900': red,
          })}
        />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function LinkCell({
  href,
  tooltip,
  className,
  children,
}: {
  href: string;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { Link } = useLinkComponent();
  const link = (
    <Link
      href={href}
      className={cn(
        'flex w-full items-center justify-center gap-4 rounded-lg px-3 py-2 text-left hover:bg-fill-subtle',
        transitions.colors,
        focusRing.visible,
        className,
      )}
    >
      {children}
    </Link>
  );

  if (tooltip === undefined) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function VersionInfo({ variant, version }: { variant?: VersionInfoVariant; version?: number }) {
  if (!variant) {
    return <span className="text-body text-muted-foreground">v. {version}</span>;
  }
  const { badgeVariant, icon, tooltip } = versionInfoConfig[variant];
  return (
    <div className="grid grid-cols-[1fr_auto]">
      {version !== undefined && (
        <span className="flex min-w-16 justify-end pr-3 text-body text-muted-foreground">v. {version}</span>
      )}
      <span className="inline-flex" role="img" aria-label={tooltip}>
        <Badge variant={badgeVariant} size="xs" icon={icon} />
      </span>
    </div>
  );
}

function getStatus(itemA?: DatasetItem, itemB?: DatasetItem): VersionStatus {
  if (itemA && itemB && itemA.datasetVersion === itemB.datasetVersion) return 'same';
  if (itemA && itemB && itemA.datasetVersion !== itemB.datasetVersion) return 'changed';
  if (itemA) return 'added';
  return 'removed';
}

function getVersionInfoVariant({
  otherVersionExists,
  status,
  isNewer,
}: {
  otherVersionExists: boolean;
  status: VersionStatus;
  isNewer: boolean;
}): VersionInfoVariant | undefined {
  if (!otherVersionExists && isNewer) return 'added';
  if (status === 'changed' && isNewer) return 'changed';
  return undefined;
}

export function DatasetCompareVersionsList({
  datasetId,
  versionA,
  versionB,
  allItems,
  itemsAMap,
  itemsBMap,
}: DatasetCompareVersionsListProps) {
  const isANewer = versionA > versionB;
  return (
    <div className="overflow-y-auto">
      <ul className="grid content-start">
        {allItems.map(({ id }) => {
          const itemA = itemsAMap.get(id);
          const itemB = itemsBMap.get(id);
          const status = getStatus(itemA, itemB);
          const versionAVariant = getVersionInfoVariant({
            otherVersionExists: itemB !== undefined,
            status,
            isNewer: isANewer,
          });
          const versionBVariant = getVersionInfoVariant({
            otherVersionExists: itemA !== undefined,
            status,
            isNewer: !isANewer,
          });

          return (
            <li
              key={id}
              className={cn(
                'grid grid-cols-[1fr_1fr_1fr_10rem] gap-3 overflow-hidden rounded-lg border border-transparent border-t-border px-3 py-[3px] pb-[2px] text-body text-foreground first:border-t-transparent',
                transitions.colors,
              )}
            >
              <div className="truncate py-[0.6rem] text-body text-placeholder">{id}</div>
              {status !== 'same' ? (
                <>
                  {itemA?.datasetVersion ? (
                    <LinkCell
                      href={`/datasets/${datasetId}/items/${id}`}
                      className="gap-2"
                      tooltip={versionAVariant ? versionInfoConfig[versionAVariant].tooltip : undefined}
                    >
                      <VersionInfo variant={versionAVariant} version={itemA.datasetVersion} />
                    </LinkCell>
                  ) : (
                    <div className="flex items-center justify-center">
                      <EmptyCell
                        red={isANewer}
                        tooltip={isANewer ? 'Deleted in this version' : 'Not present in this version'}
                      />
                    </div>
                  )}
                  {itemB?.datasetVersion ? (
                    <LinkCell
                      href={`/datasets/${datasetId}/items/${id}`}
                      className="gap-2"
                      tooltip={versionBVariant ? versionInfoConfig[versionBVariant].tooltip : undefined}
                    >
                      <VersionInfo variant={versionBVariant} version={itemB.datasetVersion} />
                    </LinkCell>
                  ) : (
                    <div className="flex items-center justify-center">
                      <EmptyCell
                        red={!isANewer}
                        tooltip={!isANewer ? 'Deleted in this version' : 'Not present in this version'}
                      />
                    </div>
                  )}
                </>
              ) : (
                <LinkCell
                  href={`/datasets/${datasetId}/items/${id}`}
                  className="col-span-2 gap-2"
                  tooltip={versionInfoConfig.same.tooltip}
                >
                  <VersionInfo variant="same" version={itemB?.datasetVersion} />
                </LinkCell>
              )}

              {status === 'changed' ? (
                <LinkCell
                  href={`/datasets/${datasetId}/items/${id}/versions?version=${itemA?.datasetVersion}&compare=${itemB?.datasetVersion}`}
                >
                  Compare
                </LinkCell>
              ) : (
                <div>
                  <EmptyCell tooltip="Comparing is available only for changed items" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

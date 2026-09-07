import type { DatasetItem } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { ItemList } from '@mastra/playground-ui/components/ItemList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
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
  onItemClick?: (itemId: string, itemA?: DatasetItem, itemB?: DatasetItem) => void;
}

const columns = [
  { name: 'id', label: 'ID', size: '1fr' },
  { name: 'versionA', label: 'Version A', size: '1fr' },
  { name: 'versionB', label: 'Version B', size: '1fr' },
  { name: 'compare', label: 'Compare', size: '10rem' },
];

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
        className="focus-visible:outline-neutral5/55 rounded focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-solid"
      >
        <BanIcon
          className={cn('text-neutral3/40 w-5 h-5 ', {
            'text-red-900': red,
          })}
        />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function VersionInfo({ variant, version }: { variant?: VersionInfoVariant; version?: number }) {
  if (!variant) {
    return <span className="text-ui-md text-neutral4">v. {version}</span>;
  }
  const { badgeVariant, icon, tooltip } = versionInfoConfig[variant];
  return (
    <div className="grid grid-cols-[1fr_auto]">
      {version !== undefined && (
        <span className="text-ui-md text-neutral4 flex min-w-16 justify-end pr-3">v. {version}</span>
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
  const { Link } = useLinkComponent();
  const isANewer = versionA > versionB;
  return (
    <ItemList>
      <ItemList.Scroller>
        <ItemList.Items>
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
              <ItemList.Row key={id} columns={columns}>
                <ItemList.IdCell id={id} isShortened={false} />
                {status !== 'same' ? (
                  <>
                    {itemA?.datasetVersion ? (
                      <ItemList.LinkCell
                        LinkComponent={Link}
                        href={`/datasets/${datasetId}/items/${id}`}
                        className="gap-2"
                        tooltip={versionAVariant ? versionInfoConfig[versionAVariant].tooltip : undefined}
                      >
                        <VersionInfo variant={versionAVariant} version={itemA.datasetVersion} />
                      </ItemList.LinkCell>
                    ) : (
                      <ItemList.Cell className={'flex items-center justify-center'}>
                        <EmptyCell
                          red={isANewer}
                          tooltip={isANewer ? 'Deleted in this version' : 'Not present in this version'}
                        />
                      </ItemList.Cell>
                    )}
                    {itemB?.datasetVersion ? (
                      <ItemList.LinkCell
                        LinkComponent={Link}
                        href={`/datasets/${datasetId}/items/${id}`}
                        className="gap-2"
                        tooltip={versionBVariant ? versionInfoConfig[versionBVariant].tooltip : undefined}
                      >
                        <VersionInfo variant={versionBVariant} version={itemB.datasetVersion} />
                      </ItemList.LinkCell>
                    ) : (
                      <ItemList.Cell className={'flex items-center justify-center'}>
                        <EmptyCell
                          red={!isANewer}
                          tooltip={!isANewer ? 'Deleted in this version' : 'Not present in this version'}
                        />
                      </ItemList.Cell>
                    )}
                  </>
                ) : (
                  <ItemList.LinkCell
                    LinkComponent={Link}
                    href={`/datasets/${datasetId}/items/${id}`}
                    className="col-span-2 gap-2"
                    tooltip={versionInfoConfig.same.tooltip}
                  >
                    <VersionInfo variant="same" version={itemB?.datasetVersion} />
                  </ItemList.LinkCell>
                )}

                {status === 'changed' ? (
                  <ItemList.LinkCell
                    LinkComponent={Link}
                    href={`/datasets/${datasetId}/items/${id}/versions?ids=${itemA?.datasetVersion},${itemB?.datasetVersion}`}
                  >
                    Compare
                  </ItemList.LinkCell>
                ) : (
                  <ItemList.Cell>
                    <EmptyCell tooltip="Comparing is available only for changed items" />
                  </ItemList.Cell>
                )}
              </ItemList.Row>
            );
          })}
        </ItemList.Items>
      </ItemList.Scroller>
    </ItemList>
  );
}

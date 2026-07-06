import { ChevronRightIcon } from 'lucide-react';
import React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export type KeyValueListItemValue = {
  id: string;
  name: React.ReactNode;
  path?: string;
  description?: React.ReactNode;
};

export type KeyValueListItemData = {
  key: string;
  label: string;
  value: Value;
  icon?: React.ReactNode;
  separator?: React.ReactNode;
};

type Value = React.ReactNode | KeyValueListItemValue[];
export type KeyValueListProps = {
  data: KeyValueListItemData[];
  labelsAreHidden?: boolean;
  className?: string;
  isLoading?: boolean;
  LinkComponent?: LinkComponent;
};

export function KeyValueList({ data, className, labelsAreHidden, isLoading, LinkComponent: Link }: KeyValueListProps) {
  const LabelWrapper = ({ children }: { children: React.ReactNode }) => {
    return labelsAreHidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 items-start content-start', className)}>
      {data.map(({ label, value, icon, separator }, index) => {
        const isValueItemArray = Array.isArray(value);

        return (
          <React.Fragment key={label + index}>
            <dt className={cn('text-neutral3 text-ui-md flex items-center gap-8 justify-between min-h-9')}>
              <span
                className={cn(
                  'flex items-center gap-2',
                  '[&>svg]:w-[1.4em] [&>svg]:h-[1.4em] [&>svg]:text-neutral3 [&>svg]:opacity-50',
                  {
                    '[&>svg]:opacity-20': isLoading,
                  },
                )}
              >
                {icon} <LabelWrapper>{label}</LabelWrapper>
              </span>
              {!labelsAreHidden && (
                <span className={cn('text-neutral3', '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:text-neutral3')}>
                  {separator}
                </span>
              )}
            </dt>
            <dd
              className={cn(
                'flex flex-wrap gap-2 py-1 min-h-9 text-ui-md items-center text-neutral5 text-wrap',
                '[&>a]:text-neutral5 [&>a]:max-w-full [&>a]:w-auto truncate [&>a]:bg-surface4 [&>a]:transition-colors [&>a]:flex [&>a]:items-center [&>a]:gap-2 [&>a]:pt-0.5 [&>a]:pb-0.5 [&>a]:px-2 [&>a]:rounded-md [&>a]:text-ui-md [&>a]:min-h-7 [&>a]:leading-none',
                '[&>a:hover]:text-neutral6 [&>a:hover]:bg-surface6',
                '[&>a>svg]:w-[1em] [&>a>svg]:h-[1em] [&>a>svg]:text-neutral3 [&>a>svg]:ml-[-0.5em]',
              )}
            >
              {(() => {
                if (isLoading) {
                  return (
                    <span
                      className={cn('bg-surface4 rounded-e-lg w-full')}
                      style={{ width: `${Math.floor(Math.random() * (90 - 30 + 1)) + 50}%` }}
                    >
                      &nbsp;
                    </span>
                  );
                }
                if (isValueItemArray) {
                  return value?.map(item => {
                    if (item.path && Link) {
                      return (
                        <RelationWrapper description={item.description} key={item.id}>
                          <Link href={item.path}>
                            {item?.name} <ChevronRightIcon />
                          </Link>
                        </RelationWrapper>
                      );
                    }
                    if (item.path) {
                      return (
                        <RelationWrapper description={item.description} key={item.id}>
                          <a href={item.path}>
                            {item?.name} <ChevronRightIcon />
                          </a>
                        </RelationWrapper>
                      );
                    }
                    return <span key={item.id}>{item?.name}</span>;
                  });
                }
                return <>{value ? value : <span className="text-neutral3 text-ui-sm">n/a</span>}</>;
              })()}
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}

type RelationWrapperProps = {
  description?: React.ReactNode;
  children?: React.ReactNode;
};

function RelationWrapper({ description, children }: RelationWrapperProps) {
  return description ? (
    <HoverCard>
      <HoverCardTrigger render={React.isValidElement(children) ? (children as React.ReactElement) : undefined} />
      <HoverCardContent className="max-w-60 text-center">{description}</HoverCardContent>
    </HoverCard>
  ) : (
    children
  );
}

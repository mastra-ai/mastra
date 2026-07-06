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

function KeyValueLabel({ hidden, children }: { hidden?: boolean; children: React.ReactNode }) {
  return hidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
}

function getLoadingValueWidth(index: number) {
  return `${50 + ((index * 17) % 41)}%`;
}

function KeyValueValue({
  value,
  isLoading,
  Link,
  index,
}: {
  value: Value;
  isLoading?: boolean;
  Link?: LinkComponent;
  index: number;
}) {
  if (isLoading) {
    return (
      <span className={cn('bg-surface4 rounded-e-lg w-full')} style={{ width: getLoadingValueWidth(index) }}>
        &nbsp;
      </span>
    );
  }
  if (Array.isArray(value)) {
    return value.map(item => {
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
}

export function KeyValueList({ data, className, labelsAreHidden, isLoading, LinkComponent: Link }: KeyValueListProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 items-start content-start', className)}>
      {data.map(({ label, value, icon, separator }, index) => {
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
                {icon} <KeyValueLabel hidden={labelsAreHidden}>{label}</KeyValueLabel>
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
              <KeyValueValue value={value} isLoading={isLoading} Link={Link} index={index} />
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

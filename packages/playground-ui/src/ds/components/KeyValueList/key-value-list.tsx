import React from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { cn } from '@/lib/utils';
import { useLinkComponent } from '@/lib/framework';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ChevronRightIcon } from 'lucide-react';

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
  LinkComponent: React.ComponentType;
  labelsAreHidden?: boolean;
  className?: string;
  isLoading?: boolean;
};

export function KeyValueList({ data, LinkComponent, className, labelsAreHidden, isLoading }: KeyValueListProps) {
  const { Link } = useLinkComponent();
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
              {isLoading ? (
                <span
                  className={cn('bg-surface4 rounded-e-lg w-full')}
                  style={{ width: `${Math.floor(Math.random() * (90 - 30 + 1)) + 50}%` }}
                >
                  &nbsp;
                </span>
              ) : isValueItemArray ? (
                value?.map(item => {
                  return item.path ? (
                    <RelationWrapper description={item.description} key={item.id}>
                      <Link href={item.path}>
                        {item?.name} <ChevronRightIcon />
                      </Link>
                    </RelationWrapper>
                  ) : (
                    <span key={item.id}>{item?.name}</span>
                  );
                })
              ) : (
                <>{value ? value : <span className="text-neutral3 text-ui-sm">n/a</span>}</>
              )}
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
    <HoverCard.Root openDelay={250}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-auto max-w-60 rounded-md bg-surface5 p-2 px-4 text-ui-sm text-neutral5 text-center"
          sideOffset={5}
          side="top"
        >
          {description}
          <HoverCard.Arrow className="fill-surface5" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  ) : (
    children
  );
}

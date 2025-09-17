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
type KeyValueListProps = {
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
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-[1rem] items-start content-start', className)}>
      {data.map(({ label, value, icon, separator }, index) => {
        const isValueItemArray = Array.isArray(value);

        return (
          <React.Fragment key={label + index}>
            <dt
              className={cn('text-icon3 text-[0.875rem] flex items-center gap-[2rem] justify-between min-h-[2.25rem] ')}
            >
              <span
                className={cn(
                  'flex items-center gap-[0.5rem]',
                  '[&>svg]:w-[1.4em] [&>svg]:h-[1.4em] [&>svg]:text-icon3 [&>svg]:opacity-50',
                  {
                    '[&>svg]:opacity-20': isLoading,
                  },
                )}
              >
                {icon} <LabelWrapper>{label}</LabelWrapper>
              </span>
              {!labelsAreHidden && (
                <span className={cn('text-icon3', '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:text-icon3')}>
                  {separator}
                </span>
              )}
            </dt>
            <dd
              className={cn(
                'flex flex-wrap gap-[.5rem] py-[0.25rem] min-h-[2.25rem] text-[0.875rem] items-center text-icon5 text-wrap',
                '[&>a]:text-icon5 [&>a]:max-w-full [&>a]:w-auto truncate [&>a]:bg-[#222] [&>a]:transition-colors [&>a]:flex [&>a]:items-center [&>a]:gap-[0.5rem] [&>a]:pt-[0.15rem] [&>a]:pb-[0.2rem] [&>a]:px-[.5rem] [&>a]:rounded-md [&>a]:text-[0.875rem] [&>a]:min-h-[1.75rem] [&>a]:leading-0 ',
                '[&>a:hover]:text-icon6 [&>a:hover]:bg-surface6',
                '[&>a>svg]:w-[1em] [&>a>svg]:h-[1em] [&>a>svg]:text-icon3 [&>a>svg]:ml-[-0.5em]',
              )}
            >
              {isLoading ? (
                <span
                  className={cn('bg-surface4 rounded-e-lg w-full')}
                  style={{ width: `${Math.floor(Math.random() * (90 - 30 + 1)) + 50}%` }}
                >
                  &nbsp;
                </span>
              ) : (
                <>
                  {isValueItemArray ? (
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
                    <>{value ? value : <span className="text-icon3 text-[0.75rem]">n/a</span>}</>
                  )}
                </>
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
          className="z-[100] w-auto max-w-[15rem] rounded-md bg-[#333] p-[.5rem] px-[1rem] text-[.75rem] text-icon5 text-center"
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

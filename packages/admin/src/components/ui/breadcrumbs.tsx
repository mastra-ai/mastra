'use client';

import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

const BreadcrumbPrimitive = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
BreadcrumbPrimitive.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<'ol'>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        'text-light-text flex items-center gap-2 break-words text-[calc(13_/_16_*_1rem)] font-medium',
        className,
      )}
      {...props}
    />
  ),
);
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItemPrimitive = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props} />
  ),
);
BreadcrumbItemPrimitive.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a';

  return <Comp ref={ref} className={cn('hover:text-text transition-colors', className)} {...props} />;
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<'span'>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('text-light-text font-medium', className)}
      {...props}
    />
  ),
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<'li'>) => (
  <li role="presentation" aria-hidden="true" className={cn('[&>svg]:size-3.5', className)} {...props}>
    {children ?? <Icon name="chevron-down" className="text-light-text h-[10px] w-[10px] -rotate-90" />}
  </li>
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <Icon name="dot-menu-sleep" className="h-4 w-4 text-current" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis';

interface BreadcrumbProps {
  items: {
    label: React.ReactNode;
    href: string;
    isCurrent?: boolean;
  }[];
  icon?: IconName;
  className?: string;
  pageClassName?: string;
}

export default function Breadcrumb({ items, icon, className, pageClassName }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-4">
      {icon && <Icon name={icon} width={16} height={16} className={className} />}
      <BreadcrumbPrimitive>
        <BreadcrumbList>
          {items.map((item, index) => {
            return (
              <span key={index} className="flex flex-nowrap items-center gap-2">
                <BreadcrumbItemPrimitive key={item.href}>
                  {item.isCurrent ? (
                    <BreadcrumbPage className={pageClassName}>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItemPrimitive>
                {index < items.length - 1 && <BreadcrumbSeparator />}
              </span>
            );
          })}
        </BreadcrumbList>
      </BreadcrumbPrimitive>
    </div>
  );
}

export {
  BreadcrumbEllipsis,
  BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbPrimitive,
  BreadcrumbSeparator,
};

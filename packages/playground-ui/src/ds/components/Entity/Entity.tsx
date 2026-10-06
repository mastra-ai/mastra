import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';

import { Card, CardDescription, CardTitle } from '../Card';
import type { CardProps } from '../Card';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface EntityProps extends Omit<CardProps, 'as' | 'onClick'> {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'section';
}

export const Entity = ({ children, className, onClick, interactive, variant = 'default', ...props }: EntityProps) => (
  <Card
    {...props}
    as="div"
    interactive={interactive || Boolean(onClick)}
    role={onClick ? 'button' : props.role}
    tabIndex={onClick ? 0 : props.tabIndex}
    onKeyDown={event => {
      props.onKeyDown?.(event);
      const canActivateCard = onClick !== undefined && !event.defaultPrevented && event.target === event.currentTarget;
      if (!canActivateCard) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    }}
    className={cn(
      'group/entity flex gap-3 text-left',
      variant === 'section' ? 'flex-col gap-0 overflow-hidden' : 'px-3 py-2',
      className,
    )}
    onClick={onClick}
  >
    {children}
  </Card>
);

export const EntityHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-start gap-3 px-4 py-3', className)} {...props} />
);

export const EntityBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('border-t border-border bg-background p-4', className)} {...props} />
);

export const EntityIcon = ({ children, className, style }: Pick<EntityProps, 'children' | 'className' | 'style'>) => (
  <Icon size="lg" className={cn('mt-1 shrink-0 text-muted-foreground', className)} style={style}>
    {children}
  </Icon>
);

export const EntityName = (props: Omit<ComponentProps<typeof CardTitle>, 'as'>) => <CardTitle as="p" {...props} />;

export const EntityDescription = (props: Omit<ComponentProps<typeof CardDescription>, 'as'>) => (
  <CardDescription as="div" {...props} />
);

export const EntityContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('min-w-0 flex-1', className)} {...props} />
);

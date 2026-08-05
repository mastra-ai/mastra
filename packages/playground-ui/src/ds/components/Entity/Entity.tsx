import { Txt } from '../Txt';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface EntityProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Entity = ({ children, className, onClick }: EntityProps) => {
  return (
    <div
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        'group/entity flex gap-3 rounded-xl border border-border1 bg-surface3 px-4 py-3',
        onClick && 'cursor-pointer transition-all hover:bg-surface4',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const EntityIcon = ({ children, className, style }: EntityProps) => {
  return (
    <Icon size="lg" className={cn('mt-1 shrink-0 text-neutral3', className)} style={style}>
      {children}
    </Icon>
  );
};

export const EntityName = ({ children, className }: EntityProps) => {
  return (
    <Txt as="p" variant="ui-lg" className={cn('font-medium text-neutral6', className)}>
      {children}
    </Txt>
  );
};

export const EntityDescription = ({ children, className }: EntityProps) => {
  return (
    <Txt as="div" variant="ui-sm" className={cn('text-neutral3', className)}>
      {children}
    </Txt>
  );
};

export const EntityContent = ({ children, className }: EntityProps) => {
  return <div className={cn('w-full flex-1', className)}>{children}</div>;
};

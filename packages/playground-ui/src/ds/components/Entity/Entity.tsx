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
        'group/entity flex gap-3 rounded-xl border border-border1 bg-surface3 px-3 py-2',
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
    <Icon size="lg" className={cn('mt-1 shrink-0 text-muted-foreground', className)} style={style}>
      {children}
    </Icon>
  );
};

export const EntityName = ({ children, className }: EntityProps) => {
  return (
    <Txt as="p" variant="heading" className={cn(' text-foreground', className)}>
      {children}
    </Txt>
  );
};

export const EntityDescription = ({ children, className }: EntityProps) => {
  return (
    <Txt as="div" variant="caption" className={cn('text-muted-foreground', className)}>
      {children}
    </Txt>
  );
};

export const EntityContent = ({ children, className }: EntityProps) => {
  return <div className={cn('w-full flex-1', className)}>{children}</div>;
};

import { Icon } from '@/ds/icons';
import { Txt } from '../Txt';
import clsx from 'clsx';

export interface EntityProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
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
      className={clsx(
        'flex gap-3 group/entity bg-surface3 rounded-lg border-sm border-border1 py-3 px-4',
        onClick && 'cursor-pointer hover:bg-surface4 transition-all',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const EntityIcon = ({ children, className }: EntityProps) => {
  return (
    <Icon size="lg" className={clsx('text-icon3 mt-1', className)}>
      {children}
    </Icon>
  );
};

export const EntityName = ({ children, className }: EntityProps) => {
  return (
    <Txt as="p" variant="ui-lg" className={clsx('text-icon6 font-medium', className)}>
      {children}
    </Txt>
  );
};

export const EntityDescription = ({ children, className }: EntityProps) => {
  return (
    <Txt as="p" variant="ui-sm" className={clsx('text-icon3', className)}>
      {children}
    </Txt>
  );
};

export const EntityContent = ({ children, className }: EntityProps) => {
  return <div className={className}>{children}</div>;
};

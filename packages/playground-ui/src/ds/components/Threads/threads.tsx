import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElementType } from 'react';
import { transitions } from '@/ds/primitives/transitions';

export interface ThreadsProps {
  children: React.ReactNode;
}

export const Threads = ({ children }: ThreadsProps) => {
  return <nav className="bg-surface2 min-h-full overflow-hidden">{children}</nav>;
};

export interface ThreadLinkProps {
  children: React.ReactNode;
  as?: ElementType;
  href?: string;
  className?: string;
  prefetch?: boolean;
  to?: string;
}

export const ThreadLink = ({ children, as: Component = 'a', href, className, prefetch, to }: ThreadLinkProps) => {
  return (
    <Component
      href={href}
      prefetch={prefetch}
      to={to}
      className={cn(
        'text-ui-sm flex h-full w-full flex-col justify-center font-medium cursor-pointer',
        transitions.colors,
        className,
      )}
    >
      {children}
    </Component>
  );
};

export interface ThreadListProps {
  children: React.ReactNode;
}

export const ThreadList = ({ children }: ThreadListProps) => {
  return <ol data-testid="thread-list">{children}</ol>;
};

export interface ThreadItemProps {
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export const ThreadItem = ({ children, isActive, className }: ThreadItemProps) => {
  return (
    <li
      className={cn(
        'border-b border-border1 group flex h-[54px] items-center justify-between gap-2 px-3 py-2',
        transitions.colors,
        'hover:bg-surface3',
        isActive && 'bg-accent1Dark',
        className,
      )}
    >
      {children}
    </li>
  );
};

export interface ThreadDeleteButtonProps {
  onClick: () => void;
}

export const ThreadDeleteButton = ({ onClick }: ThreadDeleteButtonProps) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        'shrink-0 opacity-0',
        transitions.all,
        'group-focus-within:opacity-100 group-hover:opacity-100',
        'hover:bg-surface4 hover:text-accent2',
      )}
      onClick={onClick}
    >
      <Icon>
        <X aria-label="delete thread" className="text-neutral3 hover:text-accent2 transition-colors" />
      </Icon>
    </Button>
  );
};

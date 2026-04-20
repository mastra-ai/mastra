import { X } from 'lucide-react';
import type { ElementType, MouseEvent } from 'react';
import { IconButton } from '@/ds/components/IconButton';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ThreadsProps {
  children: React.ReactNode;
}

export const Threads = ({ children }: ThreadsProps) => {
  return <nav className="min-h-full overflow-hidden">{children}</nav>;
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
        'group/thread-item flex items-center justify-between gap-2 mx-2 px-1 py-0.5 rounded-lg',
        transitions.colors,
        'hover:bg-surface3',
        isActive && 'bg-surface4',
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
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  };

  return (
    <span
      className={cn(
        'shrink-0 opacity-0 pointer-events-none',
        transitions.all,
        'group-focus-within/thread-item:opacity-100 group-focus-within/thread-item:pointer-events-auto',
        'group-hover/thread-item:opacity-100 group-hover/thread-item:pointer-events-auto',
      )}
    >
      <IconButton
        tooltip="Delete thread"
        variant="ghost"
        size="sm"
        className="hover:text-accent2"
        onClick={handleClick}
      >
        <X aria-label="delete thread" />
      </IconButton>
    </span>
  );
};

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { ElementType } from 'react';

export interface ThreadsProps {
  children: React.ReactNode;
}

export const Threads = ({ children }: ThreadsProps) => {
  return <nav className="bg-surface2 border-r-sm border-border1 min-h-full overflow-hidden">{children}</nav>;
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
      className={clsx('text-ui-sm flex h-full w-full flex-col justify-center font-medium', className)}
    >
      {children}
    </Component>
  );
};

export interface ThreadListProps {
  children: React.ReactNode;
}

export const ThreadList = ({ children }: ThreadListProps) => {
  return <ol>{children}</ol>;
};

export interface ThreadItemProps {
  children: React.ReactNode;
  isActive?: boolean;
}

export const ThreadItem = ({ children, isActive }: ThreadItemProps) => {
  return (
    <li
      className={clsx(
        'border-b-sm border-border1 hover:bg-surface3 group flex h-[54px] items-center justify-between gap-2 pl-5 py-2',
        isActive && 'bg-surface4',
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
      className="shrink-0 border-none bg-transparent opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={onClick}
    >
      <Icon>
        <X aria-label="delete thread" className="text-icon3" />
      </Icon>
    </Button>
  );
};

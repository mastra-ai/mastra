import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElementType } from 'react';
import { transitions } from '@/ds/primitives/transitions';

export interface ThreadsProps {
  children: React.ReactNode;
}

export const Threads = ({ children }: ThreadsProps) => {
  return <nav className="bg-surface1 min-h-full overflow-hidden">{children}</nav>;
};

export interface ThreadLinkProps {
  children: React.ReactNode;
  as?: ElementType;
  href?: string;
  className?: string;
  prefetch?: boolean;
  to?: string;
  isActive?: boolean;
}

export const ThreadLink = ({
  children,
  as: Component = 'a',
  href,
  className,
  prefetch,
  to,
  isActive,
}: ThreadLinkProps) => {
  return (
    <Component
      href={href}
      prefetch={prefetch}
      to={to}
      className={cn(
        'flex h-form-md w-full flex-col justify-center cursor-pointer rounded-lg px-2',
        transitions.colors,
        'hover:bg-surface3 hover:text-neutral6',
        isActive && 'bg-surface4',
        className,
      )}
    >
      <Txt variant="ui-sm" className="text-neutral3">
        {children}
      </Txt>
    </Component>
  );
};

export interface NewThreadLinkProps {
  as?: ElementType;
  href?: string;
  prefetch?: boolean;
  to?: string;
  label: string;
}

export const NewThreadLink = ({ as: Component = 'a', href, prefetch, to, label }: NewThreadLinkProps) => {
  return (
    <Component
      href={href}
      prefetch={prefetch}
      to={to}
      className={cn(
        'text-ui-sm flex h-form-md w-full items-center gap-4 font-medium cursor-pointer rounded-lg px-2',
        transitions.colors,
        'hover:bg-surface3 hover:text-neutral6',
        'text-neutral3',
      )}
    >
      <Icon className="bg-surface4 rounded-lg text-neutral3" size="lg">
        <Plus />
      </Icon>
      {label}
    </Component>
  );
};

export interface ThreadListProps {
  children: React.ReactNode;
}

export const ThreadList = ({ children }: ThreadListProps) => {
  return <ol data-testid="thread-list" className="p-2 flex flex-col gap-2">{children}</ol>;
};

export interface ThreadItemProps {
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export const ThreadItem = ({ children, isActive, className }: ThreadItemProps) => {
  return (
    <li
      data-active={isActive}
      className={cn('group relative flex items-center', className)}
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
    <IconButton
      tooltip="Delete thread"
      variant="ghost"
      size="sm"
      className={cn(
        'absolute right-2 opacity-0 border-transparent',
        transitions.all,
        'group-focus-within:opacity-100 group-hover:opacity-100',
      )}
      onClick={onClick}
    >
      <X />
    </IconButton>
  );
};

export interface ThreadEmptyProps {
  children: React.ReactNode;
}

export const ThreadEmpty = ({ children }: ThreadEmptyProps) => {
  return (
    <Txt as="p" variant="ui-sm" className="text-neutral3 p-2">
      {children}
    </Txt>
  );
};

import { X } from 'lucide-react';
import type { ElementType, MouseEvent, ReactNode } from 'react';

import { cn } from '../../../lib/utils';
import { Button } from '../Button';
import { Txt } from '../Txt';

export interface ThreadListProps {
  children: ReactNode;
  'aria-label'?: string;
  /**
   * When true, drops the standalone block chrome (background, border, rounded corners, inset)
   * so the list can render flush inside an outer container without nesting a second box.
   */
  embedded?: boolean;
}

export const ThreadList = ({ children, 'aria-label': ariaLabel = 'Threads', embedded = false }: ThreadListProps) => {
  return (
    <div className={cn('size-full', !embedded && 'pb-2 pl-2')}>
      <nav
        aria-label={ariaLabel}
        className={cn(
          'flex h-full flex-col gap-1 overflow-y-auto p-1',
          !embedded && 'rounded-studio-panel border border-border1/50 bg-surface3',
        )}
      >
        {children}
      </nav>
    </div>
  );
};

export interface ThreadListNewItemProps {
  as?: ElementType;
  href?: string;
  to?: string;
  children: ReactNode;
}

export const ThreadListNewItem = ({ as, href, to, children }: ThreadListNewItemProps) => {
  return (
    <Button as={as} href={href} to={to} variant="ghost" className="w-full justify-start rounded-xl px-3">
      {children}
    </Button>
  );
};

export const ThreadListSeparator = () => (
  <div role="separator" aria-orientation="horizontal" className="bg-border1/40 -mx-1 my-1 h-px" />
);

export interface ThreadListItemsProps {
  children: ReactNode;
}

export const ThreadListItems = ({ children }: ThreadListItemsProps) => (
  <ol className="flex flex-col gap-1" data-testid="thread-list">
    {children}
  </ol>
);

export interface ThreadListItemProps {
  as?: ElementType;
  href?: string;
  to?: string;
  isActive?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: () => void;
  deleteLabel?: string;
  className?: string;
  children: ReactNode;
}

export const ThreadListItem = ({
  as,
  href,
  to,
  isActive,
  onClick,
  onDelete,
  deleteLabel = 'delete',
  className,
  children,
}: ThreadListItemProps) => {
  return (
    <li className="group relative">
      <Button
        as={as}
        href={href}
        to={to}
        onClick={onClick}
        variant="ghost"
        className={cn(
          'w-full min-w-0 justify-start rounded-xl px-3 text-left',
          onDelete && 'pr-9',
          isActive && 'bg-surface4 text-neutral6',
          className,
        )}
      >
        <span className="min-w-0 flex-1">{children}</span>
      </Button>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          onClick={onDelete}
          aria-label={deleteLabel}
        >
          <X />
        </Button>
      )}
    </li>
  );
};

export interface ThreadListEmptyProps {
  children: ReactNode;
}

export const ThreadListEmpty = ({ children }: ThreadListEmptyProps) => {
  return (
    <Txt as="p" variant="ui-sm" className="text-neutral3 px-3 py-2">
      {children}
    </Txt>
  );
};

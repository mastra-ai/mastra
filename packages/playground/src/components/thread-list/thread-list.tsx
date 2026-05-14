import { Button, Txt } from '@mastra/playground-ui';
import { X } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ThreadListProps {
  children: ReactNode;
  'aria-label'?: string;
}

export const ThreadList = ({ children, 'aria-label': ariaLabel = 'Threads' }: ThreadListProps) => {
  return (
    <div className="h-full w-full py-2 pl-2">
      <nav
        aria-label={ariaLabel}
        className="bg-surface2 rounded-3xl border border-border2/40 h-full overflow-y-auto p-1"
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
    <Button as={as} href={href} to={to} variant="ghost" className="w-full justify-start">
      {children}
    </Button>
  );
};

export const ThreadListSeparator = () => (
  <div role="separator" aria-orientation="horizontal" className="-mx-1 my-1 h-px bg-border1/40" />
);

export interface ThreadListItemsProps {
  children: ReactNode;
}

export const ThreadListItems = ({ children }: ThreadListItemsProps) => (
  <ol className="flex flex-col gap-px" data-testid="thread-list">
    {children}
  </ol>
);

export interface ThreadListItemProps {
  as?: ElementType;
  href?: string;
  to?: string;
  isActive?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  children: ReactNode;
}

export const ThreadListItem = ({
  as,
  href,
  to,
  isActive,
  onDelete,
  deleteLabel = 'delete',
  children,
}: ThreadListItemProps) => {
  return (
    <li className="group relative">
      <Button
        as={as}
        href={href}
        to={to}
        variant="ghost"
        className={cn('w-full justify-start', isActive && 'bg-surface4 text-neutral6')}
      >
        {children}
      </Button>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
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
    <Txt as="p" variant="ui-sm" className="text-neutral3 py-3 px-5">
      {children}
    </Txt>
  );
};
